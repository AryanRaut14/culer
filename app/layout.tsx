import './globals.css';
import type { Metadata } from 'next';
import BarcelonaLogo from '../images/barcelonalogo.png';

export const metadata: Metadata = {
  title: 'Culer',
  description: 'A local-first FC Barcelona chatbot with Ollama and cloud fallbacks.',
  icons: [{ rel: 'icon', url: BarcelonaLogo.src }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
