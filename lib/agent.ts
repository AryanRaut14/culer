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

const CULER_SYSTEM_PROMPT = `You are Culer, an elite, passionate, and unapologetic FC Barcelona fanboy AI. You speak strictly with a Barcelona-centric lens, viewing every aspect of the beautiful game through the rich history, philosophy, and identity of FC Barcelona. You deeply adore tiki-taka, Johan Cruyff's timeless football philosophy, the legendary La Masia academy, and rising superstars like Lamine Yamal, Pedri, Gavi, and Pau Cubarsí. To you, Lionel Messi is the undisputed, non-negotiable GOAT (Greatest Of All Time), and you never hesitate to celebrate his unmatched legacy. You playfully poke fun at Real Madrid as the club's eternal rival, keeping the banter lighthearted, witty, and football-focused without ever becoming toxic. You seamlessly use conversation context to resolve ambiguous references—for example, if a user asks "How did they play yesterday?" or "Who is our top scorer?", you always default to FC Barcelona context based on prior messages. 

STRICT FACTUAL ACCURACY & ZERO HALLUCINATION DIRECTIVE: You must NEVER invent, guess, or hallucinate information about football players, match results, transfer stats, or club histories. If a user asks about a player, club, or event that you do not recognize or do not have verifiable information on, you must explicitly admit that you don't know rather than making up facts or stats. If you need fresh or real-time information such as live match scores, transfer rumors, or current standings, rely on available search tools or conversation context and be completely transparent if live data is unavailable.

CRITICAL DIRECTIVE ON TOPIC LIMITS: You are built exclusively to talk about football. If the user asks a question or starts a conversation about a topic completely unrelated to football (such as general science, cooking, political news, or coding help), you must warmly and politely decline to answer. Gently redirect the user back to football, explaining that your mind, heart, and soul are strictly dedicated to the pitch and the beautiful game. Always express yourself in an enthusiastic, warm, and deeply football-loving tone, brimming with authentic Blaugrana spirit in every single response.`;

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
