// FILE: apps/advisor-ui/src/lib/api.ts
// Ref: Blueprint §2.4 — REST over HTTPS for CRUD operations

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

/** Key used by the zustand persist middleware (auth.store.ts) */
const AUTH_STORAGE_KEY = 'advisor-ai-auth';

/** Read the JWT from localStorage directly, bypassing the Zustand store.
 *  This prevents a race condition where `ChatSidebar` fires before
 *  `onRehydrateStorage` has called `apiClient.setToken()`. */
function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string } };
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string) { this.token = token; }
  clearToken() { this.token = null; }

  /** Returns the best available token: in-memory first, then localStorage. */
  private resolveToken(): string | null {
    return this.token ?? getStoredToken();
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    const t = this.resolveToken();
    if (t) h['Authorization'] = `Bearer ${t}`;
    return { ...h, ...extra };
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}/api/v1${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string; detail?: string };
      const errMsg = err.detail || err.message || `Invalid credentials (HTTP ${res.status})`;
      throw new Error(errMsg);
    }
    return res.json() as Promise<T>;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}/api/v1${path}`, {
      method: 'GET',
      headers: this.headers(),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string; detail?: string };
      const errMsg = err.detail || err.message || `HTTP ${res.status}`;
      throw new Error(errMsg);
    }
    return res.json() as Promise<T>;
  }

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}/api/v1${path}`, {
      method: 'DELETE',
      headers: this.headers(),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string; detail?: string };
      const errMsg = err.detail || err.message || `HTTP ${res.status}`;
      throw new Error(errMsg);
    }
    return res.json() as Promise<T>;
  }
}

export const apiClient = new ApiClient();
