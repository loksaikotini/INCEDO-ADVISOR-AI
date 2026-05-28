// FILE: apps/advisor-ui/src/store/chat.store.ts
// Ref: Blueprint §3.1 — Zustand for chat state; React Query for server state

import { create } from 'zustand';


interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  metadata?: Record<string, unknown>;
}

interface ChatState {
  messages: ChatMessage[];
  sessionId: string;
  addMessage: (msg: ChatMessage) => void;
  updateLastMessage: (
    id: string,
    content: string,
    isStreaming: boolean,
    metadata?: Record<string, unknown>,
  ) => void;
  clearMessages: () => void;
  newSession: () => void;
  setSessionId: (id: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  sessionId: typeof window !== 'undefined' ? window.crypto.randomUUID() : 'initial-session',

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  updateLastMessage: (id, content, isStreaming, metadata) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content, isStreaming, ...(metadata ? { metadata } : {}) } : m,
      ),
    })),

  clearMessages: () =>
    set((state) => ({ messages: [], sessionId: typeof window !== 'undefined' ? window.crypto.randomUUID() : 'initial-session' })),

  newSession: () =>
    set({ messages: [], sessionId: typeof window !== 'undefined' ? window.crypto.randomUUID() : 'initial-session' }),

  setSessionId: (id) => set({ sessionId: id }),
  setMessages: (msgs) => set({ messages: msgs }),
}));
