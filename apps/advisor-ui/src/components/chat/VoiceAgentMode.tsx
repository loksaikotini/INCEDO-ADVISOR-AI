'use client';

// ─── VoiceAgentMode — Production Voice Interface (ChatGPT-style) ─────────────
//
// Flow:
//  1. Mic → AudioWorklet → PCM16 frames
//  2. If AI is generating response OR TTS is playing:
//     - We gate the mic: we send ZEROS to Deepgram (silence frames). This stops
//       the AI from transcribing its own echo, and lets Deepgram close the utterance.
//     - We measure local RMS. If user speaks loudly (>1200), we BARGE-IN:
//       we abort the LLM (onInterrupt), stop TTS, and resume sending real audio.
//  3. If AI is idle: send raw frames to Deepgram.
//  4. Final transcript → onSubmit() → existing RAG SSE pipeline
//  5. RAG text chunks → sentence segmenter → TTS queue (/api/voice/tts proxy)
//  6. TTS audio plays back gaplessly
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useEffect, useState, useRef, useCallback, useMemo,
} from 'react';
import { Mic, Volume2, MicOff, PhoneOff, Circle, Loader2 } from 'lucide-react';
import { useDeepgramSTT } from '@/hooks/useDeepgramSTT';
import { useDeepgramAuraTTS } from '@/hooks/useDeepgramAuraTTS';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { extractSpeechResponse, extractDisplayResponse } from '@/utils/responseParser';

// ─── Types ────────────────────────────────────────────────────────────────────

type VoicePhase =
  | 'initializing'
  | 'listening'
  | 'user_speaking'
  | 'thinking'
  | 'speaking'
  | 'error';

interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  id: string;
}

export interface VoiceAgentModeProps {
  onClose: () => void;
  onSubmit: (text: string) => void;
  onInterrupt: () => void;
  isAIResponding: boolean;
  latestAIResponseChunk: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// RMS threshold for barge-in detection (0–32768 scale).
// Raised to 2800 to prevent speaker echo from triggering it,
// combined with a consecutive frame confirmation to ensure robust detection.
const BARGE_IN_RMS_THRESHOLD = 2800;
const TTS_CHAR_THRESHOLD = 80;

const SENTENCE_RE = /([^.!?\n]+[.!?\n]+)/g;

function extractSentences(buf: string): { sentences: string[]; remainder: string } {
  const sentences: string[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  SENTENCE_RE.lastIndex = 0;
  while ((match = SENTENCE_RE.exec(buf)) !== null) {
    const s = match[1].trim();
    if (s) sentences.push(s);
    lastIdx = match.index + match[0].length;
  }
  return { sentences, remainder: buf.slice(lastIdx) };
}

const AURA_VOICES = [
  { id: 'aura-asteria-en', name: 'Asteria', gender: 'female', description: 'Professional & Calm' },
  { id: 'aura-luna-en', name: 'Luna', gender: 'female', description: 'Warm & Conversational' },
  { id: 'aura-stella-en', name: 'Stella', gender: 'female', description: 'Energetic & Friendly' },
  { id: 'aura-athena-en', name: 'Athena', gender: 'female', description: 'Authoritative & Clear' },
  { id: 'aura-arcas-en', name: 'Arcas', gender: 'male', description: 'Professional & Articulate' },
  { id: 'aura-orion-en', name: 'Orion', gender: 'male', description: 'Deep & Strong' },
  { id: 'aura-perseus-en', name: 'Perseus', gender: 'male', description: 'Friendly & Casual' },
  { id: 'aura-zeus-en', name: 'Zeus', gender: 'male', description: 'Commanding & Warm' },
];

// ─── Component ────────────────────────────────────────────────────────────────


export function VoiceAgentMode({
  onClose,
  onSubmit,
  onInterrupt,
  isAIResponding,
  latestAIResponseChunk,
}: VoiceAgentModeProps) {
  const [phase, setPhase] = useState<VoicePhase>('initializing');
  const [selectedVoice, setSelectedVoice] = useState('aura-asteria-en');
  const [isVoiceSelectorOpen, setIsVoiceSelectorOpen] = useState(false);
  const voiceMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (voiceMenuRef.current && !voiceMenuRef.current.contains(event.target as Node)) {
        setIsVoiceSelectorOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeVoiceInfo = useMemo(() => {
    return AURA_VOICES.find((v) => v.id === selectedVoice);
  }, [selectedVoice]);

  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isMutedRef = useRef(false);

  // Sync state to refs for the AudioWorklet handler
  const isAIRespondingRef = useRef(false);
  const onInterruptRef = useRef(onInterrupt);
  
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isAIRespondingRef.current = isAIResponding; }, [isAIResponding]);
  useEffect(() => { onInterruptRef.current = onInterrupt; }, [onInterrupt]);

  // RAG/TTS streaming state
  const spokenLengthRef = useRef(0);
  const sentenceBufferRef = useRef('');
  const lastAIEntryIdRef = useRef<string | null>(null);

  // Mic plumbing
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const consecutiveLoudFramesRef = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimText]);

  // ── Transcript helpers ────────────────────────────────────────────────────
  const addEntry = useCallback((role: 'user' | 'assistant', text: string): string => {
    if (!text.trim()) return '';
    const id = `${role}-${Date.now()}-${Math.random()}`;
    setTranscript((prev) => [...prev, { role, text, id }]);
    return id;
  }, []);

  const updateEntry = useCallback((id: string, text: string) => {
    setTranscript((prev) => prev.map((e) => (e.id === id ? { ...e, text } : e)));
  }, []);

  // ── TTS ───────────────────────────────────────────────────────────────────
  const { speakSentence, stopSpeaking, isPlaying, isPlayingRef } = useDeepgramAuraTTS(selectedVoice);

  // When TTS finishes (and LLM is done), return to listening
  useEffect(() => {
    if (!isPlaying && !isAIResponding && (phase === 'speaking' || phase === 'thinking')) {
      setPhase('listening');
    }
  }, [isPlaying, isAIResponding, phase]);

  // ── STT callbacks ─────────────────────────────────────────────────────────
  const handleSpeechStart = useCallback(() => {
    setPhase('user_speaking');
    setInterimText('');
  }, []);

  const handleSpeechEnd = useCallback(() => {
    setPhase((prev) => {
      if (prev === 'user_speaking') {
        return 'listening';
      }
      return prev;
    });
    setInterimText('');
  }, []);

  const handleInterimTranscript = useCallback((text: string) => {
    setInterimText(text);
  }, []);

  const handleFinalTranscript = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setInterimText('');
      addEntry('user', trimmed);

      // Reset TTS pipeline for next response
      spokenLengthRef.current = 0;
      sentenceBufferRef.current = '';
      lastAIEntryIdRef.current = null;

      setPhase('thinking');
      onSubmit(trimmed);
    },
    [addEntry, onSubmit]
  );

  const {
    isListening, error: sttError,
    startListening, stopListening, sendAudio,
  } = useDeepgramSTT({
    onFinalTranscript: handleFinalTranscript,
    onInterimTranscript: handleInterimTranscript,
    onSpeechStart: handleSpeechStart,
    onSpeechEnd: handleSpeechEnd,
  });

  // Surface STT errors
  useEffect(() => {
    if (sttError) { setErrorMsg(sttError); setPhase('error'); }
  }, [sttError]);

  // ── Mic setup (runs once on mount) ───────────────────────────────────────
  const sendAudioRef = useRef(sendAudio);
  const stopSpeakingRef = useRef(stopSpeaking);
  useEffect(() => { sendAudioRef.current = sendAudio; }, [sendAudio]);
  useEffect(() => { stopSpeakingRef.current = stopSpeaking; }, [stopSpeaking]);

  useEffect(() => {
    let cancelled = false;

    async function startMic() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

        micStreamRef.current = stream;
        const ctx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = ctx;

        await ctx.audioWorklet.addModule('/mic-worklet.js');
        const source = ctx.createMediaStreamSource(stream);
        const worklet = new AudioWorkletNode(ctx, 'mic-processor');
        workletNodeRef.current = worklet;

        worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
          if (isMutedRef.current) return;

          // If AI is still streaming from backend OR TTS is playing out loud
          if (isAIRespondingRef.current || isPlayingRef.current) {
            
            // ── Local Barge-In Detection ──
            const samples = new Int16Array(e.data);
            let sumSq = 0;
            for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i];
            const rms = Math.sqrt(sumSq / samples.length);

            if (rms > BARGE_IN_RMS_THRESHOLD) {
              consecutiveLoudFramesRef.current += 1;
              if (consecutiveLoudFramesRef.current >= 12) { // ~96ms of sustained loud sound
                // User interrupted the AI!
                onInterruptRef.current(); // Stop LLM stream
                stopSpeakingRef.current(); // Stop TTS audio
                sendAudioRef.current(e.data); // Send actual speech frame
                consecutiveLoudFramesRef.current = 0;
              } else {
                // Send zeros until confirmed to avoid feeding partial noise to STT
                const zeros = new ArrayBuffer(e.data.byteLength);
                sendAudioRef.current(zeros);
              }
            } else {
              consecutiveLoudFramesRef.current = 0;
              // AI has the floor, send ZEROS (silence) to Deepgram.
              // Sending zeros instead of dropping frames forces Deepgram's VAD
              // to realize the user stopped speaking, closing out the transcript quickly!
              const zeros = new ArrayBuffer(e.data.byteLength);
              sendAudioRef.current(zeros);
            }
            return;
          }

          consecutiveLoudFramesRef.current = 0; // Reset when AI is silent
          // Normal: AI is silent, send all mic audio to Deepgram
          sendAudioRef.current(e.data);
        };

        source.connect(worklet);
        startListening();

        await new Promise<void>((resolve) => setTimeout(resolve, 400));
        if (!cancelled) setPhase('listening');
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Microphone error';
          setErrorMsg(
            msg.toLowerCase().includes('permission')
              ? 'Microphone permission denied. Allow access and reload.'
              : msg
          );
          setPhase('error');
        }
      }
    }

    void startMic();

    return () => {
      cancelled = true;
      try { workletNodeRef.current?.disconnect(); } catch { /**/ }
      if (audioCtxRef.current?.state !== 'closed') {
        audioCtxRef.current?.close().catch(() => { /**/ });
      }
      stopListening();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // ── TTS: feed RAG stream → sentence queue ────────────────────────────────
  useEffect(() => {
    if (!isAIResponding) {
      // Response complete — flush anything remaining in the sentence buffer
      const remaining = sentenceBufferRef.current.trim();
      if (remaining) {
        speakSentence(remaining);
        sentenceBufferRef.current = '';
      }
      spokenLengthRef.current = 0;
      return;
    }

    // Store the RAW full response in the transcript entry so the UI parser works
    if (!lastAIEntryIdRef.current) {
      lastAIEntryIdRef.current = addEntry('assistant', latestAIResponseChunk);
      setPhase('speaking');
    } else {
      updateEntry(lastAIEntryIdRef.current, latestAIResponseChunk);
    }

    // Extract ONLY the <speech_response> portion for TTS
    const parsedSpeech = extractSpeechResponse(latestAIResponseChunk);
    if (!parsedSpeech || parsedSpeech.length <= spokenLengthRef.current) return;

    // Get only the NEW part of speech text since last render
    const newSpeech = parsedSpeech.slice(spokenLengthRef.current);
    spokenLengthRef.current = parsedSpeech.length;
    sentenceBufferRef.current += newSpeech;

    // Dispatch complete sentences immediately for low-latency TTS
    const { sentences, remainder } = extractSentences(sentenceBufferRef.current);
    sentenceBufferRef.current = remainder;
    for (const s of sentences) speakSentence(s);

    // Early trigger: if buffer is getting long, don't wait for sentence end
    if (sentenceBufferRef.current.length >= TTS_CHAR_THRESHOLD) {
      speakSentence(sentenceBufferRef.current);
      sentenceBufferRef.current = '';
    }
  }, [isAIResponding, latestAIResponseChunk, addEntry, updateEntry, speakSentence]);

  // ── Derived UI ─────────────────────────────────────────────────────────────
  const statusLabel = useMemo(() => {
    switch (phase) {
      case 'initializing': return 'Starting microphone…';
      case 'listening':    return 'Listening — speak now';
      case 'user_speaking': return 'I\'m listening…';
      case 'thinking':     return 'Thinking…';
      case 'speaking':     return 'AI Advisor speaking…';
      case 'error':        return errorMsg ?? 'Something went wrong';
    }
  }, [phase, errorMsg]);

  const orbClass = useMemo(() => {
    switch (phase) {
      case 'speaking':      return 'from-blue-500 to-indigo-600 shadow-blue-500/60 scale-110 animate-liquid-orb-fast';
      case 'user_speaking': return 'from-emerald-500 to-teal-600 shadow-emerald-500/60 scale-105 animate-liquid-orb-fast';
      case 'thinking':      return 'from-amber-500 to-orange-500 shadow-amber-500/40 animate-liquid-orb';
      case 'error':         return 'from-rose-600/20 to-rose-700/20';
      default:              return 'from-slate-700 to-slate-800 animate-liquid-orb';
    }
  }, [phase]);

  const OrbIcon = useMemo(() => {
    switch (phase) {
      case 'speaking':      return <Volume2 className="w-10 h-10 text-white" />;
      case 'user_speaking': return <Mic className="w-10 h-10 text-white" />;
      case 'thinking':      return <Loader2 className="w-10 h-10 text-white animate-spin" />;
      case 'error':         return <PhoneOff className="w-10 h-10 text-rose-400" />;
      default:              return <Circle className="w-10 h-10 text-slate-500" />;
    }
  }, [phase]);

  const statusColor = useMemo(() => {
    switch (phase) {
      case 'speaking':      return 'text-blue-400';
      case 'user_speaking': return 'text-emerald-400';
      case 'thinking':      return 'text-amber-400';
      case 'error':         return 'text-rose-400';
      default:              return 'text-muted-foreground';
    }
  }, [phase]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background rounded-xl border border-border shadow-2xl overflow-hidden">
      <style>{`
        @keyframes blob-morph {
          0%, 100% { border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%; }
          25% { border-radius: 70% 30% 52% 48% / 60% 40% 60% 40%; }
          50% { border-radius: 50% 50% 30% 70% / 50% 60% 40% 50%; }
          75% { border-radius: 45% 55% 40% 60% / 45% 50% 50% 55%; }
        }
        .animate-liquid-orb {
          animation: blob-morph 8s ease-in-out infinite;
        }
        .animate-liquid-orb-fast {
          animation: blob-morph 3s ease-in-out infinite;
        }
      `}</style>
      <div className="flex items-center justify-between px-5 py-3 border-b border-border glass shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
            Voice Mode
          </span>
          {isListening && !isMuted && phase !== 'error' && (
            <span className="text-[10px] text-muted-foreground ml-2">· Mic active</span>
          )}
        </div>
        <button
          onClick={() => { stopSpeaking(); stopListening(); onClose(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
          title="End voice session"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          End
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        <div className="flex-shrink-0 lg:w-72 p-8 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-border/40 gap-6">
          <div className="relative w-44 h-44">
            {phase === 'speaking' && (
              <>
                <div className="absolute inset-0 rounded-full border-2 border-blue-500/25 animate-ping" />
                <div className="absolute inset-3 rounded-full border border-blue-400/15 animate-ping" style={{ animationDelay: '350ms' }} />
                <div className="absolute inset-6 rounded-full border border-blue-300/10 animate-ping" style={{ animationDelay: '700ms' }} />
              </>
            )}
            {phase === 'user_speaking' && (
              <>
                <div className="absolute inset-0 rounded-full border-2 border-emerald-400/30 animate-ping" />
                <div className="absolute inset-4 rounded-full border border-emerald-400/20 animate-ping" style={{ animationDelay: '300ms' }} />
              </>
            )}
            {phase === 'thinking' && (
              <div className="absolute inset-0 rounded-full border border-amber-400/20 animate-pulse" />
            )}
            <div className={`absolute inset-7 rounded-full flex items-center justify-center shadow-2xl bg-gradient-to-br transition-all duration-500 ${orbClass}`}>
              {OrbIcon}
            </div>
          </div>

          <div className="text-center space-y-1.5">
            <p className="text-sm font-bold text-foreground tracking-tight">Advisor Voice AI</p>
            <p className={`text-xs font-medium transition-colors duration-300 ${statusColor}`}>
              {statusLabel}
            </p>
            {phase === 'speaking' && (
              <p className="text-[10px] text-muted-foreground/60">
                Speak to interrupt
              </p>
            )}
          </div>

          {/* Custom Voice Selector dropdown */}
          <div className="relative w-full z-20" ref={voiceMenuRef}>
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block text-center mb-1.5">
              Aura Voice Model
            </label>
            <button
              onClick={() => setIsVoiceSelectorOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-secondary/50 text-foreground border border-border/80 hover:bg-secondary hover:border-primary/30 transition-all font-semibold text-xs shadow-sm focus:outline-none"
            >
              <div className="flex items-center gap-2 text-left">
                <div className={`w-2 h-2 rounded-full ${
                  activeVoiceInfo?.gender === 'female' ? 'bg-indigo-400 animate-pulse' : 'bg-sky-400 animate-pulse'
                }`} />
                <div>
                  <div className="font-bold text-foreground">{activeVoiceInfo?.name}</div>
                  <div className="text-[9px] text-muted-foreground font-normal">{activeVoiceInfo?.description}</div>
                </div>
              </div>
              <svg className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isVoiceSelectorOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isVoiceSelectorOpen && (
              <div className="absolute left-0 right-0 bottom-full z-30 mb-2 max-h-56 overflow-y-auto rounded-xl border border-border bg-background/95 backdrop-blur-md p-1.5 shadow-xl transition-all scrollbar-thin">
                <div className="text-[9px] font-bold text-muted-foreground/60 px-2 py-1 uppercase tracking-widest border-b border-border/20 mb-1">Female Voices</div>
                {AURA_VOICES.filter(v => v.gender === 'female').map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => {
                      setSelectedVoice(voice.id);
                      setIsVoiceSelectorOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 my-0.5 rounded-lg text-left transition-all ${
                      selectedVoice === voice.id
                        ? 'bg-blue-500/10 text-blue-400 font-bold'
                        : 'text-foreground hover:bg-secondary/80'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs">{voice.name}</span>
                      <span className="text-[9px] text-muted-foreground font-normal">{voice.description}</span>
                    </div>
                    {selectedVoice === voice.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    )}
                  </button>
                ))}

                <div className="text-[9px] font-bold text-muted-foreground/60 px-2 py-1 mt-2 uppercase tracking-widest border-b border-border/20 mb-1">Male Voices</div>
                {AURA_VOICES.filter(v => v.gender === 'male').map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => {
                      setSelectedVoice(voice.id);
                      setIsVoiceSelectorOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 my-0.5 rounded-lg text-left transition-all ${
                      selectedVoice === voice.id
                        ? 'bg-blue-500/10 text-blue-400 font-bold'
                        : 'text-foreground hover:bg-secondary/80'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs">{voice.name}</span>
                      <span className="text-[9px] text-muted-foreground font-normal">{voice.description}</span>
                    </div>
                    {selectedVoice === voice.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setIsMuted((m) => !m)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              isMuted
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                : 'bg-secondary/50 text-muted-foreground border-border hover:bg-secondary hover:text-foreground'
            }`}
          >
            {isMuted
              ? <><MicOff className="w-4 h-4" /> Unmute Microphone</>
              : <><Mic className="w-4 h-4" /> Mute Microphone</>
            }
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-secondary/10">
          <div className="px-5 py-3 border-b border-border/30 shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Conversation
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {transcript.length === 0 && phase !== 'error' && (
              <div className="flex flex-col items-center justify-center h-full opacity-40 gap-3 select-none">
                <Mic className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Say something to begin</p>
              </div>
            )}

            {phase === 'error' && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <p className="text-sm font-medium text-rose-400">{errorMsg}</p>
                <p className="text-xs text-rose-400/60 mt-1">
                  Check microphone permissions and reload the page.
                </p>
              </div>
            )}

            {transcript.map((entry) => (
              <div
                key={entry.id}
                className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
              >
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  entry.role === 'assistant'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-foreground'
                    : 'bg-secondary border border-border text-foreground'
                }`}>
                  <span className={`text-[9px] font-black uppercase tracking-widest block mb-1.5 ${
                    entry.role === 'assistant' ? 'text-blue-400' : 'text-emerald-400'
                  }`}>
                    {entry.role === 'assistant' ? 'AI Advisor' : 'You'}
                  </span>
                  {entry.role === 'assistant' ? (
                    <div className="markdown-body space-y-3 text-[13px]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {extractDisplayResponse(entry.text) || '…'}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    entry.text
                  )}
                </div>
              </div>
            ))}

            {interimText && (
              <div className="flex justify-end animate-fade-in-up">
                <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-emerald-500/5 border border-emerald-500/10 text-muted-foreground italic">
                  <span className="text-[9px] font-black uppercase tracking-widest block mb-1.5 text-emerald-400/60">
                    You
                  </span>
                  {interimText}…
                </div>
              </div>
            )}

            <div ref={scrollRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
