import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useDeepgramAuraTTS
 * Text-to-speech using Deepgram Aura via the server-side /api/voice/tts proxy.
 * The Deepgram API key never leaves the server.
 *
 * Features:
 * - Sentence queue for streaming playback (speaks sentence-by-sentence)
 * - Gapless scheduling with WebAudio API
 * - stop() immediately cuts audio (barge-in support)
 */
export function useDeepgramAuraTTS(selectedVoice: string = 'aura-asteria-en') {
  const [isPlaying, setIsPlaying] = useState(false);

  const voiceRef = useRef(selectedVoice);
  useEffect(() => {
    voiceRef.current = selectedVoice;
  }, [selectedVoice]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const queueRef = useRef<string[]>([]);
  const isFetchingRef = useRef(false);
  const isPlayingRef = useRef(false);

  // Create AudioContext lazily (must follow a user gesture)
  const ensureAudioCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
      nextStartTimeRef.current = audioCtxRef.current.currentTime;
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  /**
   * Play raw PCM16 audio through WebAudio.
   * Schedules gaplessly after the previous chunk.
   */
  const playPCMChunk = useCallback((pcm16: ArrayBuffer) => {
    const ctx = ensureAudioCtx();

    const int16 = new Int16Array(pcm16);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    if (nextStartTimeRef.current < now) nextStartTimeRef.current = now;

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;

    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
      // When all sources finish and the queue is empty → not playing
      if (activeSourcesRef.current.length === 0 && queueRef.current.length === 0 && !isFetchingRef.current) {
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    };

    activeSourcesRef.current.push(source);

    if (!isPlayingRef.current) {
      isPlayingRef.current = true;
      setIsPlaying(true);
    }
  }, [ensureAudioCtx]);

  /**
   * Fetch TTS audio from the server-side proxy and play it.
   */
  const fetchAndPlay = useCallback(async (text: string) => {
    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model: voiceRef.current }),
      });

      if (!res.ok) {
        console.error('[TTS] Proxy error:', res.status, await res.text().catch(() => ''));
        return;
      }

      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > 0) {
        playPCMChunk(arrayBuffer);
      }
    } catch (err) {
      console.error('[TTS] Fetch error:', err);
    } finally {
      isFetchingRef.current = false;
      // Process next item in queue
      processQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playPCMChunk]); // processQueue defined below — safe because of useCallback hoisting

  const processQueue = useCallback(() => {
    if (isFetchingRef.current || queueRef.current.length === 0) return;
    const text = queueRef.current.shift()!;
    isFetchingRef.current = true;
    void fetchAndPlay(text);
  }, [fetchAndPlay]);

  /**
   * Enqueue a sentence for TTS playback.
   * Sentences are played in order, gaplessly.
   */
  const speakSentence = useCallback(
    (sentence: string) => {
      if (!sentence.trim()) return;
      queueRef.current.push(sentence.trim());
      processQueue();
    },
    [processQueue]
  );

  /**
   * Immediately stop all TTS audio and clear the queue.
   * Used for barge-in when the user starts speaking.
   */
  const stopSpeaking = useCallback(() => {
    // Clear queue first so no new audio is fetched
    queueRef.current = [];
    isFetchingRef.current = false;

    // Stop all scheduled/playing sources
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Source may have already ended
      }
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;

    isPlayingRef.current = false;
    setIsPlaying(false);
  }, []);

  return { speakSentence, stopSpeaking, isPlaying, isPlayingRef };
}
