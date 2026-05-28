// FILE: apps/advisor-ui/src/store/auth.store.ts
// Ref: Blueprint §3.1 — Zustand for global state management

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/lib/api';

interface AuthUser {
  id: string;
  firm_id: string;
  name?: string;
  email?: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  setUser: (user: AuthUser) => void;
  setToken: (token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setUser: (user) => set({ user }),
      setToken: (token) => {
        // Sync token to API client on every set
        apiClient.setToken(token);
        set({ token });
      },
      clearAuth: () => {
        apiClient.clearToken();
        set({ user: null, token: null });
      },
    }),
    {
      name: 'advisor-ai-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        // Re-sync API client token after rehydration
        if (state?.token) apiClient.setToken(state.token);
      },
    },
  ),
);
