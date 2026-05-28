import { NextResponse } from 'next/server';

/**
 * POST /api/deepgram-proxy
 * Bridges Deepgram Agent API's OpenAI-format LLM requests to our RAG backend.
 * Forwards auth token from the browser session and uses a real session_id.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Deepgram sends OpenAI format: { messages: [...], model: "..." }
    const messages: Array<{ role: string; content: string }> = body.messages || [];
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    const query = lastUserMessage?.content ?? '';

    if (!query.trim()) {
      return new Response('No query found', { status: 400 });
    }

    // Extract session_id from body (client should pass it) or generate one
    const sessionId: string = (body.session_id as string) || `voice-${Date.now()}`;

    // Forward the Authorization header from the incoming request so the
    // api-gateway JWT guard passes. For voice sessions, we use a server-side
    // service token if no user token is available.
    const incomingAuth = req.headers.get('Authorization') ?? '';
    const authHeader = incomingAuth || `Bearer ${process.env.VOICE_SERVICE_TOKEN ?? ''}`;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

    const ragResponse = await fetch(`${apiUrl}/api/v1/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        session_id: sessionId,
        message: query,
        modality: 'voice',
      }),
    });

    if (!ragResponse.ok) {
      console.error('[DeepgramProxy] RAG backend error:', ragResponse.status);
      return new Response(`Backend error: ${ragResponse.status}`, { status: 502 });
    }

    // Transform our custom SSE stream to OpenAI-format SSE for Deepgram Agent
    const stream = new ReadableStream({
      async start(controller) {
        const reader = ragResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            // Keep the last incomplete line in buffer
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (!data || data === '[DONE]') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                continue;
              }

              try {
                const parsed = JSON.parse(data) as {
                  type: string;
                  content?: string;
                };
                if (
                  (parsed.type === 'chunk' || parsed.type === 'done') &&
                  parsed.content
                ) {
                  const openAiChunk = {
                    id: `chatcmpl-${Date.now()}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: 'advisor-rag',
                    choices: [
                      {
                        index: 0,
                        delta: { content: parsed.content },
                        finish_reason: null,
                      },
                    ],
                  };
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(openAiChunk)}\n\n`)
                  );
                }
              } catch {
                // Non-JSON line — skip
              }
            }
          }
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[DeepgramProxy] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
