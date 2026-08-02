'use client';

import { useEffect, useMemo, useState } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState('');
  const [status, setStatus] = useState('Starting up...');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedThread = localStorage.getItem('culer-thread-id');
    if (storedThread) {
      setThreadId(storedThread);
    } else {
      const newThread = crypto.randomUUID();
      localStorage.setItem('culer-thread-id', newThread);
      setThreadId(newThread);
    }
  }, []);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: 'ping', threadId }),
        });
        const data = await res.json();
        setStatus(data.mode === 'ollama' ? 'Using Ollama locally' : 'Using cloud fallback');
      } catch {
        setStatus('Waiting for model setup');
      }
    };

    if (threadId) {
      loadStatus();
    }
  }, [threadId]);

  const sendMessage = async () => {
    if (!input.trim() || !threadId) return;
    const userMessage = { role: 'user' as const, content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setStatus('Thinking...');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, threadId }),
      });

      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply || 'No reply.' }]);
      setStatus(data.mode === 'ollama' ? 'Using Ollama locally' : 'Using cloud fallback');
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'The chat is currently unavailable. Check your Ollama setup and API keys.' }]);
      setStatus('Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-8">
      <header className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-400">Culer</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">FC Barcelona chatbot</h1>
        <p className="mt-2 text-sm text-slate-400">Fully local first, with free cloud fallbacks when needed.</p>
        <div className="mt-4 inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">
          {status}
        </div>
      </header>

      <section className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
            Ask Culer about Barcelona, matchday, transfers, or football philosophy.
          </div>
        )}
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user' ? 'ml-auto bg-cyan-600 text-white' : 'bg-slate-800 text-slate-100'}`}>
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          </div>
        ))}
        {loading && <div className="text-sm text-slate-400">Culer is thinking...</div>}
      </section>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage();
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about Barcelona, the next match, or Messi..."
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none ring-0"
        />
        <button type="submit" className="rounded-xl bg-cyan-600 px-4 py-3 text-sm font-medium text-white">
          Send
        </button>
      </form>
    </main>
  );
}
