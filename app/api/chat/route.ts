import { NextRequest } from 'next/server';
import { createAgent, getAgentStatus } from '@/lib/agent';
import { initializeMemory } from '@/lib/memory';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { message, threadId } = body as { message?: string; threadId?: string };

  if (!message) {
    return new Response('Message is required', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await initializeMemory();
        const agent = await createAgent();
        const status = await getAgentStatus();

        if (!status.ollamaStatus.available && !status.hasFallbackCredentials) {
          controller.enqueue(
            encoder.encode(
              'Culer is in degraded mode: Ollama is not available and no cloud API keys are configured yet. Install Ollama or add a free Gemini/Groq key and restart the app.\n\n[mode:cloud-fallback]',
            ),
          );
          controller.close();
          return;
        }

        const result = await agent.invoke(
          {
            messages: [{ role: 'user', content: message }],
          },
          {
            configurable: {
              thread_id: threadId || 'default-thread',
            },
          },
        );

        const lastMessage = result.messages[result.messages.length - 1];
        const reply = typeof lastMessage?.content === 'string' ? lastMessage.content : '...';

        const chunkSize = 24;
        for (let index = 0; index < reply.length; index += chunkSize) {
          const chunk = reply.slice(index, index + chunkSize);
          controller.enqueue(encoder.encode(chunk));
          await new Promise((resolve) => setTimeout(resolve, 12));
        }

        controller.enqueue(encoder.encode(`\n\n[mode:${status.mode}]`));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(
          encoder.encode(`Culer is unavailable right now. ${message}\n\n[mode:cloud-fallback]`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
