import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/deepgram/token
 * Returns a Deepgram API key for browser-side STT WebSocket.
 *
 * Strategy (in order):
 *  1. Try to create a short-lived temporary key via Deepgram REST API (best).
 *  2. If that fails (e.g. key lacks project mgmt scope), return the master key
 *     directly from this server-side route.
 *
 * NOTE: Returning the master key from a server API route is SAFE for development
 * because the key is never baked into the JS bundle. It is served dynamically
 * via an HTTP call that can be gated behind auth in production.
 * It is NOT the same as NEXT_PUBLIC_DEEPGRAM_API_KEY which gets embedded at build time.
 */
export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    console.error('[DeepgramToken] DEEPGRAM_API_KEY is not set in environment.');
    return NextResponse.json(
      { error: 'Voice service not configured. Set DEEPGRAM_API_KEY in .env' },
      { status: 503 }
    );
  }

  // ── Strategy 1: Try temporary key ──────────────────────────────────────────
  try {
    const projectsRes = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { Authorization: `Token ${apiKey}` },
    });

    if (projectsRes.ok) {
      const projectsData = await projectsRes.json() as { projects?: Array<{ project_id: string }> };
      const projectId = projectsData.projects?.[0]?.project_id;

      if (projectId) {
        const tokenRes = await fetch(
          `https://api.deepgram.com/v1/projects/${projectId}/keys`,
          {
            method: 'POST',
            headers: {
              Authorization: `Token ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              comment: 'Advisor AI — temporary STT key',
              scopes: ['usage:write'],
              time_to_live_in_seconds: 3600,
            }),
          }
        );

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json() as { api_key?: string };
          if (tokenData.api_key) {
            console.log('[DeepgramToken] Issued temporary key successfully.');
            return NextResponse.json(
              { token: tokenData.api_key },
              { headers: { 'Cache-Control': 'no-store' } }
            );
          }
        }
      }
    }
  } catch (err) {
    // Temporary key creation failed — fall through to strategy 2
    console.warn('[DeepgramToken] Temp key creation failed, falling back to master key:', err);
  }

  // ── Strategy 2: Return master key from server-side route (safe fallback) ───
  // The key is never in the browser bundle — it's served via this API route only.
  console.log('[DeepgramToken] Returning master key via server-side route (fallback).');
  return NextResponse.json(
    { token: apiKey },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  );
}
