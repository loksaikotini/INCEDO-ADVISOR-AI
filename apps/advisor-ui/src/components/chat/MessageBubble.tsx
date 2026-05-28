'use client';
// FILE: apps/advisor-ui/src/components/chat/MessageBubble.tsx
// Ref: Blueprint §2.3 — Responses with rationale (explainability) surfaced in UI
// Ref: Blueprint §5.5 — Explainability: AI rationale shown to advisor

import { Brain, User2, CheckCircle, AlertTriangle, XCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { extractDisplayResponse } from '@/utils/responseParser';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  metadata?: {
    use_case_detected?: string;
    compliance_outcome?: string;
    latency_ms?: number;
    model_used?: string;
    explainability?: {
      reasoning_steps?: string[];
      data_sources_used?: string[];
      confidence_score?: number;
      human_review_required?: boolean;
    };
    audit_id?: string;
  };
}

interface MessageBubbleProps {
  message: Message;
}

const COMPLIANCE_INDICATORS = {
  PASS: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', label: 'Compliance Passed' },
  WARN: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Compliance Warning' },
  BLOCKED: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Compliance Blocked' },
};

const USE_CASE_LABELS: Record<string, { label: string; color: string }> = {
  ADVISOR_PRODUCTIVITY: { label: 'Productivity', color: 'text-blue-400' },
  CLIENT_INTELLIGENCE: { label: 'Client Intel', color: 'text-purple-400' },
  PORTFOLIO_INSIGHTS: { label: 'Portfolio', color: 'text-cyan-400' },
  CONVERSATIONAL_SEARCH: { label: 'Search', color: 'text-green-400' },
  COMPLIANCE_SUPERVISION: { label: 'Compliance', color: 'text-amber-400' },
  REVENUE_ENABLEMENT: { label: 'Revenue', color: 'text-orange-400' },
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const [showExplainability, setShowExplainability] = useState(false);
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex gap-3 justify-end animate-fade-in-up">
        <div className="max-w-2xl">
          <div className="bg-blue-600/20 border border-blue-500/25 rounded-2xl rounded-tr-sm px-4 py-3">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 mt-1">
          <User2 className="w-4 h-4 text-blue-400" />
        </div>
      </div>
    );
  }

  // Assistant message
  const compliance = message.metadata?.compliance_outcome
    ? COMPLIANCE_INDICATORS[message.metadata.compliance_outcome as keyof typeof COMPLIANCE_INDICATORS]
    : null;

  const useCase = message.metadata?.use_case_detected
    ? USE_CASE_LABELS[message.metadata.use_case_detected]
    : null;
    
  const displayContent = extractDisplayResponse(message.content);

  return (
    <div className="flex gap-3 animate-fade-in-up">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 mt-1 glow-blue">
        <Brain className="w-4 h-4 text-blue-400" />
      </div>

      <div className="flex-1 max-w-3xl space-y-2">
        {/* Message bubble */}
        <div className="glass rounded-2xl rounded-tl-sm px-4 py-3">
          {/* Meta badges */}
          {(useCase || message.metadata?.latency_ms) && (
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/50">
              {useCase && (
                <span className={`text-[10px] font-medium ${useCase.color} uppercase tracking-wide`}>
                  {useCase.label}
                </span>
              )}
              {message.metadata?.latency_ms && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {message.metadata.latency_ms.toFixed(0)}ms
                </span>
              )}
            </div>
          )}

          {/* Content with streaming cursor */}
          <div className={`text-sm text-foreground leading-relaxed overflow-x-auto ${message.isStreaming ? 'streaming-cursor' : ''}`}>
            {displayContent ? (
              <div className="markdown-body space-y-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {displayContent}
                </ReactMarkdown>
              </div>
            ) : (
              message.isStreaming ? '' : '…'
            )}
          </div>
        </div>

        {/* Compliance Status */}
        {compliance && !message.isStreaming && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${compliance.bg}`}>
            <compliance.icon className={`w-3.5 h-3.5 ${compliance.color}`} />
            <span className={compliance.color}>{compliance.label}</span>
            {message.metadata?.audit_id && (
              <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                {message.metadata.audit_id.slice(0, 8)}
              </span>
            )}
          </div>
        )}

        {/* Explainability toggle — Ref: Blueprint §5.5 */}
        {message.metadata?.explainability && !message.isStreaming && (
          <div>
            <button
              onClick={() => setShowExplainability((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Info className="w-3 h-3" />
              AI Reasoning
              {showExplainability ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showExplainability && (
              <div className="mt-2 p-3 rounded-xl border border-border/50 bg-secondary/30 space-y-2 animate-fade-in-up">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Reasoning Steps
                </p>
                {message.metadata.explainability.reasoning_steps?.map((step, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-[10px] text-blue-400 font-mono shrink-0">{i + 1}.</span>
                    <p className="text-xs text-muted-foreground">{step}</p>
                  </div>
                ))}
                {message.metadata.explainability.data_sources_used && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/30">
                    <span className="text-[10px] text-muted-foreground">Sources:</span>
                    {message.metadata.explainability.data_sources_used.map((src) => (
                      <span key={src} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                        {src}
                      </span>
                    ))}
                  </div>
                )}
                {message.metadata.explainability.confidence_score !== undefined && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] text-muted-foreground">Confidence:</span>
                    <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${(message.metadata.explainability.confidence_score * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {(message.metadata.explainability.confidence_score * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
                {message.metadata.explainability.human_review_required && (
                  <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="text-[11px] text-amber-300">Human review required before acting on this recommendation</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
