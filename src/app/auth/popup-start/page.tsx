'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function PopupStartPage() {
  return (
    <Suspense fallback={<Redirecting />}>
      <PopupStartInner />
    </Suspense>
  );
}

/**
 * Tiny page rendered inside an OAuth popup.
 * Immediately calls signIn(provider) so the popup goes straight to the
 * provider (GitHub/Google) without showing NextAuth's default chooser.
 * After auth, the provider redirects back to /auth/popup-callback,
 * which posts a message to the opener and closes the popup.
 */
function PopupStartInner() {
  const params = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const provider = params?.get('provider') ?? 'github';
    if (provider !== 'github' && provider !== 'google') {
      window.location.href = '/login';
      return;
    }
    signIn(provider, { callbackUrl: '/auth/popup-callback' });
  }, [params]);

  return <Redirecting />;
}

function Redirecting() {
  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 24,
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <p>Redirecting…</p>
    </main>
  );
}
