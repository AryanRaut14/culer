import { NextRequest, NextResponse } from 'next/server';
import { createAgent, getAgentStatus } from '@/lib/agent';
import { initializeMemory } from '@/lib/memory';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { message, threadId } = body as { message?: string; threadId?: string };

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

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

    return NextResponse.json({ reply, mode: status.mode, statusText: status.ollamaStatus.reason || 'Ready' });
  } catch (error) {
    return NextResponse.json({
      reply: 'Culer is unavailable right now. Make sure Ollama is installed or add your free API keys to the environment file.',
      mode: 'cloud-fallback',
      statusText: 'Fallback mode',
    });
  }
}
