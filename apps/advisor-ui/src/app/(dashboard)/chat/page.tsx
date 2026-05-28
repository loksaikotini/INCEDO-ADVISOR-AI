'use client';
// FILE: apps/advisor-ui/src/app/(dashboard)/chat/page.tsx
// Ref: Blueprint §3.1 — Conversational UI (chat + voice); SSE streaming rendering
// Ref: Blueprint §4.1-4.6 — All 6 use cases surfaced via chat

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { apiClient } from '@/lib/api';
import {
  Send, Sparkles, RotateCcw, User2,
  FileText, TrendingUp, Shield, Lightbulb, Search, Mic
} from 'lucide-react';
import { VoiceAgentMode } from '@/components/chat/VoiceAgentMode';
import { ChatSidebar } from '@/components/chat/ChatSidebar';

// Utility to parse XML-like tags from streaming responses
function extractTagContent(content: string, tag: string): string {
  const openTag = `<${tag}>`;
  const closeTag = `</${tag}>`;
  const startIndex = content.indexOf(openTag);
  if (startIndex === -1) return '';
  const contentStart = startIndex + openTag.length;
  const endIndex = content.indexOf(closeTag, contentStart);
  if (endIndex === -1) {
    return content.substring(contentStart).trimStart();
  }
  return content.substring(contentStart, endIndex).trim();
}

function getDisplayContent(content: string): string {
  const display = extractTagContent(content, 'display_response');
  if (display) return display;
  if (content.includes('<speech_response>')) return ''; // Still generating speech
  return content; // Fallback for raw text
}

function getSpeechContent(content: string): string {
  return extractTagContent(content, 'speech_response');
}


// Quick-action prompt templates — Ref: Blueprint §4.1-4.6 use cases
const QUICK_ACTIONS = [
  {
    icon: TrendingUp,
    label: 'Portfolio Summary',
    prompt: 'Summarize my top client portfolio performance today',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20',
  },
  {
    icon: Shield,
    label: 'Compliance Check',
    prompt: 'What are the active compliance alerts for my book today?',
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20 hover:bg-green-500/20',
  },
  {
    icon: Lightbulb,
    label: 'Revenue Opportunities',
    prompt: 'Show me cross-sell and upsell opportunities for my high-net-worth clients',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20',
  },
  {
    icon: FileText,
    label: 'Meeting Prep',
    prompt: 'Prepare a client 360 summary for my next meeting',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20',
  },
  {
    icon: Search,
    label: 'Search Holdings',
    prompt: 'Search holdings with technology sector concentration above 40%',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500/20',
  },
];

export default function ChatPage() {
  const { token, user } = useAuthStore();
  const { messages, sessionId, addMessage, updateLastMessage, clearMessages } = useChatStore();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  // Track latest assistant response content for voice TTS feeding
  const [voiceStreamingContent, setVoiceStreamingContent] = useState('');
  const [voiceIsResponding, setVoiceIsResponding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // isVoiceMode ref — prevents stale closure inside sendMessage useCallback
  const isVoiceModeRef = useRef(isVoiceMode);
  useEffect(() => { isVoiceModeRef.current = isVoiceMode; }, [isVoiceMode]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-scroll to latest message

  // ── Send Message with SSE Streaming ───────────────────────────────────────────
  // Ref: Blueprint §2.4 — SSE for LLM streaming responses
  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isStreaming) return;

    const userMessage = { role: 'user' as const, content: messageText, id: window.crypto.randomUUID() };
    addMessage(userMessage);
    setInput('');
    setIsStreaming(true);
    // Reset voice streaming state
    setVoiceStreamingContent('');
    setVoiceIsResponding(true);

    // Placeholder for streaming response
    const assistantId = window.crypto.randomUUID();
    addMessage({ role: 'assistant' as const, content: '', id: assistantId, isStreaming: true });

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001'}/api/v1/chat/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            session_id: sessionId,
            message: messageText,
            modality: 'text',
          }),
          signal: abortControllerRef.current.signal,
          credentials: 'include',
        },
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(errData.message ?? `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let metadata: Record<string, unknown> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            if (!data) continue;

            try {
              const parsed = JSON.parse(data) as {
                type: string;
                content?: string;
                metadata?: Record<string, unknown>;
              };

              if (parsed.type === 'chunk' && parsed.content) {
                accumulatedContent += parsed.content;
                
                const displayHtml = getDisplayContent(accumulatedContent);
                
                // Chat store always gets the display-only content (for MessageBubble)
                updateLastMessage(assistantId, displayHtml || accumulatedContent, true);
                // Voice mode gets the full raw content so it can parse speech vs display itself
                if (isVoiceModeRef.current) setVoiceStreamingContent(accumulatedContent);
              } else if (parsed.type === 'done' && parsed.metadata) {
                metadata = parsed.metadata;
                
                const displayHtml = getDisplayContent(accumulatedContent);
                
                // Final update: chat store gets display content, voice gets raw
                updateLastMessage(assistantId, displayHtml || accumulatedContent, false, metadata);
                if (isVoiceModeRef.current) setVoiceStreamingContent(accumulatedContent);
              } else if (parsed.type === 'error') {
                throw new Error(parsed.content ?? 'Stream error');
              }
            } catch {
              // Non-JSON SSE data (raw text chunk)
              if (data !== '[DONE]') {
                accumulatedContent += data;
                
                const displayHtml = getDisplayContent(accumulatedContent);
                
                updateLastMessage(assistantId, displayHtml || accumulatedContent, true);
                if (isVoiceModeRef.current) setVoiceStreamingContent(accumulatedContent);
              }
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        updateLastMessage(assistantId, '[Response cancelled]', false);
      } else {
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to connect to Advisor AI. Please try again.';
        updateLastMessage(
          assistantId,
          `⚠️ **Error:** ${errorMsg}\n\nPlease ensure the API Gateway is running.`,
          false,
        );
      }
    } finally {
      setIsStreaming(false);
      setVoiceIsResponding(false);
      abortControllerRef.current = null;
    }
  // isVoiceMode removed from deps — accessed via ref to prevent re-creation
  }, [token, sessionId, addMessage, updateLastMessage, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  return (
    <div className="flex h-full w-full bg-slate-50 dark:bg-slate-950">
      <ChatSidebar />
      <div className="flex flex-col h-full relative flex-1 min-w-0">
        {isVoiceMode ? (
        <div className="flex-1 overflow-hidden">
          <VoiceAgentMode
            onClose={() => setIsVoiceMode(false)}
            onSubmit={(text) => void sendMessage(text)}
            onInterrupt={handleStop}
            isAIResponding={voiceIsResponding}
            latestAIResponseChunk={voiceStreamingContent}
          />
        </div>
      ) : (
        <>
          {/* ── Messages Area ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          /* ── Empty State — Quick Actions ─────────────────────────────────── */
          <div className="h-full flex flex-col items-center justify-center py-12 animate-fade-in-up">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center mb-4 glow-blue">
              <Sparkles className="w-7 h-7 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-1">
              How can I help you today?
            </h2>
            <p className="text-sm text-muted-foreground mb-8 text-center max-w-sm">
              Ask me anything about your clients, portfolio performance, compliance alerts, or revenue opportunities.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-2xl">
              {QUICK_ACTIONS.map(({ icon: Icon, label, prompt, color, bg }) => (
                <button
                  key={label}
                  onClick={() => void sendMessage(prompt)}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-150 ${bg}`}
                >
                  <Icon className={`w-4 h-4 ${color} shrink-0 mt-0.5`} />
                  <div>
                    <div className="text-xs font-semibold text-foreground">{label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{prompt}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Message Thread ──────────────────────────────────────────────── */
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* ── Input Area ────────────────────────────────────────────────────── */}
      <div className="border-t border-border p-4 glass shrink-0">
        {/* Action bar */}
        <div className="flex items-center gap-2 mb-3">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              New conversation
            </button>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="flex gap-3 items-end">

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about portfolios, clients, compliance, or opportunities…"
              rows={1}
              disabled={isStreaming}
              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all disabled:opacity-50 min-h-[44px] max-h-32 overflow-y-auto"
              style={{ height: 'auto' }}
            />
          </div>

          {/* Send / Stop */}
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-all shrink-0"
              title="Stop generation"
            >
              <span className="w-3 h-3 rounded-sm bg-red-400" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsVoiceMode(true)}
                className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-all shrink-0"
                title="Start Voice Mode"
              >
                <Mic className="w-4 h-4" />
              </button>
              <button
                type="submit"
                disabled={!input.trim()}
                className="w-10 h-10 rounded-xl bg-blue-600 disabled:bg-secondary disabled:cursor-not-allowed flex items-center justify-center text-white hover:bg-blue-500 transition-all shrink-0 glow-blue disabled:shadow-none"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </form>
        <p className="text-center text-[10px] text-muted-foreground/50 mt-2">
          All responses are compliance-reviewed · FINRA/SEC audit-logged
        </p>
      </div>
      </>
      )}
      </div>
    </div>
  );
}
