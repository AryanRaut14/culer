# Culer

Culer is a fully local-first FC Barcelona chatbot. It prefers Ollama on your own machine, but it gracefully falls back to free Google Gemini and Groq APIs when the local model is unavailable.

## Setup

1. Install Ollama from https://ollama.com
2. Pull a local model manually:
   ```bash
   ollama pull llama3.1
   ```
3. Get free API keys:
   - Google Gemini: https://aistudio.google.com
   - Groq: https://console.groq.com
   - Tavily: https://tavily.com
4. Create or update your local env file without overwriting existing values:
   ```bash
   cp .env.example .env.local
   ```
   If .env.local already exists, edit it directly and keep your API keys there. Do not run the copy command again unless you want to reset the file.
5. Install dependencies:
   ```bash
   npm install
   ```
6. Start the app:
   ```bash
   npm run dev
   ```

Open http://localhost:3000.

No account signup is required for the local experience. Everything beyond installing Ollama is just pasting API keys into your local env file.
