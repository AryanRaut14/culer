import { ChatOllama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatGroq } from '@langchain/groq';
import { AIMessage, HumanMessage } from '@langchain/core/messages';

const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1';

function makeOllamaModel() {
  return new ChatOllama({
    model: ollamaModel,
    temperature: 0.7,
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  });
}

function makeGeminiModel() {
  return new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
    temperature: 0.7,
    apiKey: process.env.GOOGLE_API_KEY,
  });
}

function makeGroqModel() {
  return new ChatGroq({
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0.7,
    apiKey: process.env.GROQ_API_KEY,
  });
}

export async function getChatModel() {
  const ollama = makeOllamaModel();
  const gemini = makeGeminiModel();
  const groq = makeGroqModel();

  const fallbackChain = ollama.withFallbacks({
    fallbacks: [gemini, groq],
  });

  return fallbackChain;
}

export async function checkOllamaAvailability() {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) {
      return { available: false, reason: 'Ollama is not responding at localhost:11434.' };
    }

    const data = await response.json();
    const models = Array.isArray(data.models) ? data.models : [];
    const names = models.map((m: any) => m.name || m.model || '').filter(Boolean);
    const hasModel = names.some((name: string) => name.includes(ollamaModel));

    return {
      available: true,
      hasModel,
      models: names,
    };
  } catch (error) {
    return { available: false, reason: 'Ollama is not running or unreachable.' };
  }
}
