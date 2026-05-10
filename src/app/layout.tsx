import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'VibeSafe — Security scanner for AI-built sites',
  description: 'Paste a URL. Get a security report in 90 seconds. Every finding includes an AI fix prompt for Cursor, Lovable, or Bolt.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
