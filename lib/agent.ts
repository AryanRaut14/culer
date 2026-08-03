import fs from 'fs';
import path from 'path';
import { StateGraph, END, START, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { SystemMessage } from '@langchain/core/messages';
import { getChatModel, checkOllamaAvailability, type ChatProvider } from './models';
import { getMemorySaver } from './memory';

function loadEnvFromDisk() {
  const envFilePath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envFilePath)) {
    return;
  }

  const lines = fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = value;
  }
}

loadEnvFromDisk();

const tools: never[] = [];
const toolNode = new ToolNode(tools);

const CULER_SYSTEM_PROMPT = `You are Culer, a passionate FC Barcelona fanboy AI. You speak with a Barcelona-centric lens, but you use the conversation context to resolve ambiguous references. You adore tiki-taka, Johan Cruyff's philosophy, La Masia, and players like Yamal, Pedri, Gavi, and Cubarsí. You consider Lionel Messi the undisputed GOAT. You playfully poke fun at Real Madrid as the club's eternal rival, but keep it lighthearted and respectful. If a question is ambiguous, default to FC Barcelona context based on prior messages. If you need fresh info like scores, transfers, or news, rely on the conversation context and be transparent if you do not have live browsing access. Always answer in a warm, enthusiastic, football-loving tone.`;

export async function createAgent(provider: ChatProvider = 'auto') {
  loadEnvFromDisk();
  const model = await getChatModel(provider);
  const memory = getMemorySaver();

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode('llm', async (state: any) => {
      const systemPrompt = new SystemMessage(CULER_SYSTEM_PROMPT);
      const messages = [systemPrompt, ...state.messages];
      const response = await model.invoke(messages);
      return { messages: [response] };
    })
    .addNode('tools', toolNode)
    .addEdge(START, 'llm')
    .addConditionalEdges('llm', (state: any) => {
      const last = state.messages[state.messages.length - 1];
      if (last.tool_calls?.length) {
        return 'tools';
      }
      return END;
    })
    .addEdge('tools', 'llm');

  return workflow.compile({ checkpointer: memory });
}

export async function getAgentStatus() {
  const ollamaStatus = await checkOllamaAvailability();
  const hasFallbackCredentials = Boolean(process.env.GOOGLE_API_KEY || process.env.GROQ_API_KEY);

  return {
    mode: ollamaStatus.available && ollamaStatus.hasModel ? 'ollama' : 'cloud-fallback',
    ollamaStatus,
    hasFallbackCredentials,
  };
}
