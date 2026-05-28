import { useState, useRef, useCallback, useEffect } from 'react';

export interface DeepgramSTTOptions {
  onFinalTranscript: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

export interface DeepgramSTTResult {
  isListening: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  sendAudio: (audioData: ArrayBuffer) => void;
}

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 500;

export function useDeepgramSTT({
  onFinalTranscript,
  onInterimTranscript,
  onSpeechStart,
  onSpeechEnd,
}: DeepgramSTTOptions): DeepgramSTTResult {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Stable callback refs ──────────────────────────────────────────────────
  const cbFinal = useRef(onFinalTranscript);
  const cbInterim = useRef(onInterimTranscript);
  const cbSpeechStart = useRef(onSpeechStart);
  const cbSpeechEnd = useRef(onSpeechEnd);
  useEffect(() => { cbFinal.current = onFinalTranscript; }, [onFinalTranscript]);
  useEffect(() => { cbInterim.current = onInterimTranscript; }, [onInterimTranscript]);
  useEffect(() => { cbSpeechStart.current = onSpeechStart; }, [onSpeechStart]);
  useEffect(() => { cbSpeechEnd.current = onSpeechEnd; }, [onSpeechEnd]);

  // ── Internal refs ──────────────────────────────
  const tokenRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const isStartingRef = useRef(false);

  // ── Fetch token on mount ──────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    const controller = new AbortController();

    fetch('/api/deepgram/token', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
        return res.json() as Promise<{ token?: string; error?: string }>;
      })
      .then((data) => {
        if (!isMountedRef.current) return;
        if (data.token) {
          tokenRef.current = data.token;
        } else {
          setError(data.error ?? 'Failed to fetch Deepgram token');
        }
      })
      .catch((err: unknown) => {
        if (!isMountedRef.current) return;
        if ((err as { name?: string }).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to fetch Deepgram token');
      });

    return () => {
      isMountedRef.current = false;
      controller.abort();
    };
  }, []);

  // ── Full teardown ─────────────────────────────────────────────────────────
  const teardown = useCallback((clearError = false) => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
    const ws = wsRef.current;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'CloseStream' }));
      }
      ws.close();
      wsRef.current = null;
    }

    isStartingRef.current = false;
    if (isMountedRef.current) {
      setIsListening(false);
      if (clearError) setError(null);
    }
  }, []);

  // ── Open Deepgram WebSocket ───────────────────────────────────────────────
  const openSocket = useCallback((token: string) => {
    if (!isMountedRef.current) return;

    const url = new URL('wss://api.deepgram.com/v1/listen');
    url.searchParams.set('model', 'nova-2-general');
    url.searchParams.set('encoding', 'linear16');
    url.searchParams.set('sample_rate', '16000');
    url.searchParams.set('channels', '1');
    url.searchParams.set('interim_results', 'true');
    url.searchParams.set('endpointing', '2000');
    url.searchParams.set('utterance_end_ms', '2000');
    url.searchParams.set('vad_events', 'true');
    url.searchParams.set('smart_format', 'true');

    const ws = new WebSocket(url.toString(), ['token', token]);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) { ws.close(); return; }
      retryCountRef.current = 0;
      setIsListening(true);
      setError(null);

      keepAliveRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'KeepAlive' }));
        }
      }, 5000);
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'SpeechStarted':
            cbSpeechStart.current?.();
            break;
          case 'UtteranceEnd':
            cbSpeechEnd.current?.();
            break;
          case 'Results': {
            const transcript = msg.channel?.alternatives?.[0]?.transcript ?? '';
            if (msg.is_final) {
              if (transcript.trim()) cbFinal.current(transcript);
            } else {
              cbInterim.current?.(transcript);
            }
            break;
          }
        }
      } catch (e) {
        console.error('[STT] Parse error', e);
      }
    };

    ws.onerror = () => {
      // Handled in onclose
    };

    ws.onclose = (event) => {
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
      wsRef.current = null;

      if (!isMountedRef.current) return;

      if (event.code === 1000) {
        setIsListening(false);
        return;
      }

      if (retryCountRef.current < MAX_RETRIES) {
        const delay = BASE_BACKOFF_MS * 2 ** retryCountRef.current;
        retryCountRef.current++;
        setError(`Connection lost. Reconnecting (${retryCountRef.current}/${MAX_RETRIES})…`);
        retryTimerRef.current = setTimeout(() => {
          if (isMountedRef.current && tokenRef.current) {
            openSocket(tokenRef.current);
          }
        }, delay);
      } else {
        setIsListening(false);
        setError('Voice connection failed after multiple retries.');
      }
    };
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (isStartingRef.current || wsRef.current?.readyState === WebSocket.OPEN) return;
    isStartingRef.current = true;
    setError(null);

    if (!tokenRef.current) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (tokenRef.current) {
          clearInterval(interval);
          isStartingRef.current = false;
          startListening();
        } else if (attempts >= 30) {
          clearInterval(interval);
          isStartingRef.current = false;
          setError('Voice service unavailable. Check DEEPGRAM_API_KEY.');
        }
      }, 100);
      return;
    }

    retryCountRef.current = 0;
    openSocket(tokenRef.current);
    isStartingRef.current = false;
  }, [openSocket]);

  const stopListening = useCallback(() => {
    retryCountRef.current = MAX_RETRIES;
    teardown(true);
  }, [teardown]);

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(audioData);
    }
  }, []);

  return { isListening, error, startListening, stopListening, sendAudio };
}
