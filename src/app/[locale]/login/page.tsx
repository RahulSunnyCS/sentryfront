import type { Metadata } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { authConfig } from '@/lib/features';
import { LoginCard } from './login-card';

export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Sign in to VibeSafe to manage your scans, buy credits, enable 24/7 monitoring, and track your security grade over time.',
  alternates: { canonical: '/login' },
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  // OAuth client IDs aren't secrets (only the matching client_secrets are),
  // so we read them from the server-only env here and pass them down to the
  // client component as props. Avoids having to duplicate them into a
  // NEXT_PUBLIC_* variable.
  const googleClientId = authConfig.nextauth.google.clientId;

  return (
    <>
      {googleClientId && (
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      )}
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
            <LoginCard googleClientId={googleClientId} />
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
