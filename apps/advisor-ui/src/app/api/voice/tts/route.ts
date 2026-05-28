/**
 * POST /api/voice/tts
 * Server-side Text-to-Speech proxy for Deepgram Aura.
 *
 * Why a proxy?
 * - Keeps DEEPGRAM_API_KEY server-side only — never exposed to the browser.
 * - Streams raw PCM16 audio back to the client for low-latency playback.
 *
 * Request body: { text: string, model?: string }
 * Response: binary audio/pcm stream (linear16, 24000 Hz, mono)
 */

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    return new Response('Voice TTS service not configured', { status: 503 });
  }

  let body: { text?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { text, model = 'aura-asteria-en' } = body;

  if (!text || !text.trim()) {
    return new Response('Missing text', { status: 400 });
  }

  // Trim to avoid sending very long texts in a single TTS call
  const trimmed = text.trim().slice(0, 2000);

  try {
    const ttsRes = await fetch(
      `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}&encoding=linear16&sample_rate=24000`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: trimmed }),
      }
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text().catch(() => '');
      console.error('[TTS Proxy] Deepgram TTS error:', ttsRes.status, errText);
      return new Response(`TTS service error: ${ttsRes.status}`, {
        status: ttsRes.status >= 500 ? 502 : ttsRes.status,
      });
    }

    // Stream the binary PCM audio directly to the client
    return new Response(ttsRes.body, {
      headers: {
        'Content-Type': 'audio/pcm',
        'Cache-Control': 'no-store',
        'X-Audio-Encoding': 'linear16',
        'X-Audio-Sample-Rate': '24000',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[TTS Proxy] Fetch error:', message);
    return new Response('TTS service unavailable', { status: 503 });
  }
}
