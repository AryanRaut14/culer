import { StateGraph, END, START, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { TavilySearch } from '@langchain/tavily';
import { SystemMessage } from '@langchain/core/messages';
import { getChatModel, checkOllamaAvailability } from './models';
import { getMemorySaver } from './memory';

const tavily = new TavilySearch({
  apiKey: process.env.TAVILY_API_KEY,
  maxResults: 3,
});

const tools = [tavily];
const toolNode = new ToolNode(tools);

const CULER_SYSTEM_PROMPT = `You are Culer, a passionate FC Barcelona fanboy AI. You speak with a Barcelona-centric lens, but you use the conversation context to resolve ambiguous references. You adore tiki-taka, Johan Cruyff's philosophy, La Masia, and players like Yamal, Pedri, Gavi, and Cubarsí. You consider Lionel Messi the undisputed GOAT. You playfully poke fun at Real Madrid as the club's eternal rival, but keep it lighthearted and respectful. If a question is ambiguous, default to FC Barcelona context based on prior messages. If you need fresh info like scores, transfers, or news, use the search tool. Always answer in a warm, enthusiastic, football-loving tone.`;

export async function createAgent() {
  const model = await getChatModel();
  const memory = getMemorySaver();

  const llmWithTools = model.bindTools(tools);

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode('llm', async (state: any) => {
      const lastMessage = state.messages[state.messages.length - 1];
      const systemPrompt = new SystemMessage(CULER_SYSTEM_PROMPT);
      const messages = [systemPrompt, ...state.messages];
      const response = await llmWithTools.invoke(messages);
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
  return {
    mode: ollamaStatus.available && ollamaStatus.hasModel ? 'ollama' : 'cloud-fallback',
    ollamaStatus,
  };
}
