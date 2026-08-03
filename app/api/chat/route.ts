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

        const providers: Array<'ollama' | 'google' | 'groq'> = [];
        if (status.ollamaStatus.available) {
          providers.push('ollama');
        }
        if (process.env.GOOGLE_API_KEY) {
          providers.push('google');
        }
        if (process.env.GROQ_API_KEY) {
          providers.push('groq');
        }

        let lastError: unknown;
        for (const provider of providers) {
          try {
            const agent = await createAgent(provider);
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
            const reply = (() => {
              for (let index = result.messages.length - 1; index >= 0; index -= 1) {
                const message = result.messages[index] as any;
                const content = message?.content;

                if (typeof content === 'string' && content.trim()) {
                  return content;
                }

                if (Array.isArray(content)) {
                  const text = content
                    .map((item: any) => {
                      if (typeof item === 'string') return item;
                      if (typeof item?.text === 'string') return item.text;
                      return '';
                    })
                    .join('')
                    .trim();
                  if (text) return text;
                }

                if (content && typeof content === 'object' && typeof (content as any).text === 'string') {
                  const text = (content as any).text.trim();
                  if (text) return text;
                }
              }

              return '...';
            })();

            const chunkSize = 24;
            for (let index = 0; index < reply.length; index += chunkSize) {
              const chunk = reply.slice(index, index + chunkSize);
              controller.enqueue(encoder.encode(chunk));
              await new Promise((resolve) => setTimeout(resolve, 12));
            }

            controller.enqueue(encoder.encode(`\n\n[mode:${provider === 'ollama' ? 'ollama' : 'cloud-fallback'}]`));
            return;
          } catch (error) {
            lastError = error;
          }
        }

        throw lastError ?? new Error('No providers were available.');
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
