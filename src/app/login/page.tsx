import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { LoginCard } from './login-card';

export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Sign in to VibeSafe to manage your scans, buy credits, enable 24/7 monitoring, and track your security grade over time.',
  alternates: { canonical: '/login' },
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <>
      <Nav />
      <div style={{ paddingTop: 'var(--nav-h)', display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <main
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-10) var(--space-4)',
          }}
        >
          <Suspense fallback={<LoginFallback />}>
            <LoginCard />
          </Suspense>
        </main>
        <Footer />
      </div>
    </>
  );
}

function LoginFallback() {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 440,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'clamp(24px, 5vw, 40px)',
        boxShadow: 'var(--shadow-md)',
        minHeight: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Loading...</div>
    </div>
  );
}
