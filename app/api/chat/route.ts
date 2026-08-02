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
        controller.enqueue(
          encoder.encode('Culer is unavailable right now. Make sure Ollama is installed or add your free API keys to the environment file.\n\n[mode:cloud-fallback]'),
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
