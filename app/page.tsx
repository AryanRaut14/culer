'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import BarcelonaLogo from '../images/barcelonalogo.png';
import CampNouBackground from '../images/campnou.jpg';

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
        const text = await res.text();
        const modeMatch = text.match(/\[mode:([^\]]+)\]/);
        setStatus(modeMatch?.[1] === 'ollama' ? 'Using Ollama locally' : 'Using cloud fallback');
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

    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, threadId }),
      });

      if (!res.body) throw new Error('No stream body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, content: reply.replace(/\n\n\[mode:[^\]]+\]/, '') };
          }
          return next;
        });
      }

      const text = decoder.decode();
      if (text) {
        reply += text;
      }

      const modeMatch = reply.match(/\[mode:([^\]]+)\]/);
      const mode = modeMatch?.[1] === 'ollama' ? 'Using Ollama locally' : 'Using cloud fallback';
      setStatus(mode);
    } catch (error) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = { ...last, content: 'The chat is currently unavailable. Check your Ollama setup and API keys.' };
        }
        return next;
      });
      setStatus('Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="relative flex min-h-screen flex-col overflow-hidden bg-cover bg-center bg-no-repeat font-sans"
      style={{
        backgroundImage: `url(${CampNouBackground.src})`,
        backgroundAttachment: 'fixed',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-slate-950/35" />
      <div className="relative z-10 flex-1 px-4 py-8 mx-auto w-full max-w-5xl flex flex-col">
        {/* Header */}
        <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between rounded-2xl border-2 border-red-600/50 bg-blue-950/70 p-6 shadow-2xl backdrop-blur-lg">
          <div className="flex items-center gap-5">
            <Image
              src={BarcelonaLogo}
              alt="FC Barcelona Logo"
              width={70}
              height={70}
              className="object-contain"
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-red-500">Culer</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white md:text-4xl">FC Barcelona Assistant</h1>
              <p className="mt-2 text-base text-blue-100">Fully local first, with free cloud fallbacks when needed.</p>
            </div>
          </div>
          <div className="mt-5 md:mt-0 inline-flex self-start md:self-center items-center rounded-full border border-red-500/40 bg-red-600/20 px-4 py-1.5 text-sm font-medium text-red-200">
            {status}
          </div>
        </header>

        {/* Chat Container */}
        <section className="flex-1 space-y-4 overflow-y-auto rounded-2xl border-2 border-blue-900/60 bg-blue-950/70 p-5 shadow-2xl backdrop-blur-lg">
          {messages.length === 0 && (
            <div className="rounded-xl border border-dashed border-red-500/40 bg-red-950/30 p-5 text-base text-blue-100">
              <strong className="text-red-400">Visca el Barça!</strong> Ask me about Barcelona&apos;s history, current squad, matchday info, transfers, or the club&apos;s iconic football philosophy.
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-[85%] rounded-2xl px-5 py-3.5 border ${
                message.role === 'user'
                  ? 'ml-auto bg-red-700 border-red-500/50 text-white shadow-lg'
                  : 'bg-blue-900/90 border-blue-700/50 text-blue-50 shadow-md'
              }`}
            >
              <p className="whitespace-pre-wrap text-base leading-relaxed">{message.content}</p>
            </div>
          ))}
          {loading && <div className="text-sm text-red-400 italic animate-pulse px-2">Culer is thinking...</div>}
        </section>

        {/* Input Form */}
        <form
          className="mt-5 flex gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage();
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about Barcelona, the next match, or Messi..."
            className="flex-1 rounded-xl border-2 border-red-600/40 bg-blue-950/70 px-5 py-4 text-base text-white placeholder-blue-300 outline-none focus:border-red-500 transition"
          />
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-red-600 to-blue-700 px-8 py-4 text-base font-bold text-white shadow-lg hover:from-red-700 hover:to-blue-800 transition duration-150"
          >
            Send
          </button>
        </form>
      </div>
    </main>
  );
}