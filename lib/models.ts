import fs from 'fs';
import path from 'path';
import { ChatOllama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatGroq } from '@langchain/groq';

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
    const value = line.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = value.replace(/^['"]|['"]$/g, '');
  }
}

function getOllamaModelName() {
  loadEnvFromDisk();
  return process.env.OLLAMA_MODEL || 'llama3.1';
}

function makeOllamaModel() {
  loadEnvFromDisk();
  return new ChatOllama({
    model: getOllamaModelName(),
    temperature: 0.7,
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  });
}

function makeGeminiModel() {
  loadEnvFromDisk();
  return new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
    temperature: 0.7,
    apiKey: process.env.GOOGLE_API_KEY,
  });
}

function makeGroqModel() {
  loadEnvFromDisk();
  return new ChatGroq({
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0.7,
    apiKey: process.env.GROQ_API_KEY,
  });
}

export async function getChatModel() {
  loadEnvFromDisk();

  const ollamaStatus = await checkOllamaAvailability();
  if (ollamaStatus.available && ollamaStatus.hasModel) {
    return makeOllamaModel();
  }

  if (process.env.GOOGLE_API_KEY) {
    return makeGeminiModel();
  }

  if (process.env.GROQ_API_KEY) {
    return makeGroqModel();
  }

  throw new Error('No chat model available. Install Ollama or add a Google/Groq API key.');
}

export async function checkOllamaAvailability() {
  loadEnvFromDisk();

  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) {
      return { available: false, reason: 'Ollama is not responding at localhost:11434.' };
    }

    const data = await response.json();
    const models = Array.isArray(data.models) ? data.models : [];
    const names = models.map((m: any) => m.name || m.model || '').filter(Boolean);
    const hasModel = names.some((name: string) => name.includes(getOllamaModelName()));

    return {
      available: true,
      hasModel,
      models: names,
    };
  } catch (error) {
    return { available: false, reason: 'Ollama is not running or unreachable.' };
  }
}
