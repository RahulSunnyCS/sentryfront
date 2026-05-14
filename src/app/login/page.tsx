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
          <Suspense fallback={null}>
            <LoginCard />
          </Suspense>
        </main>
        <Footer />
      </div>
    </>
  );
}
