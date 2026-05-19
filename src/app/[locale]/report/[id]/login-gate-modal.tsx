'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Logo } from '@/components/logo';

export function LoginGateModal({ callbackUrl }: { callbackUrl: string }) {
  const [loading, setLoading] = useState<'github' | 'google' | null>(null);

  const handleGithub = () => {
    const width = 520;
    const height = 640;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);

    const popupCallback = `${window.location.origin}/auth/popup-callback`;
    const signInUrl = `/auth/popup-start?provider=github&callbackUrl=${encodeURIComponent(popupCallback)}`;

    const popup = window.open(
      signInUrl,
      'github-oauth',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
    );

    if (!popup) {
      void signIn('github', { callbackUrl });
      return;
    }

    setLoading('github');

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string } | null)?.type !== 'oauth-complete') return;
      window.removeEventListener('message', onMessage);
      clearInterval(closeWatcher);
      try { popup.close(); } catch { /* ignore */ }
      window.location.href = callbackUrl;
    };
    window.addEventListener('message', onMessage);

    const closeWatcher = setInterval(() => {
      if (popup.closed) {
        window.removeEventListener('message', onMessage);
        clearInterval(closeWatcher);
        setLoading(null);
      }
    }, 500);
  };

  const handleGoogle = () => {
    setLoading('google');
    void signIn('google', { callbackUrl });
  };

  return (
    <div
      data-testid="login-gate-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-gate-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.60)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        padding: 'var(--space-4)',
        animation: 'screenEnter 0.2s ease-out both',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          padding: 'clamp(28px, 5vw, 40px)',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Logo size={26} />
        </div>

        <div style={{ fontSize: 36, marginBottom: 12 }} aria-hidden="true">🔐</div>

        <h2
          id="login-gate-title"
          style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 10px' }}
        >
          Your report is ready
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 28px' }}>
          Sign in to view your full security report and save it to your dashboard. It only takes a second.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {/* GitHub */}
          <button
            type="button"
            onClick={handleGithub}
            disabled={loading !== null}
            className="btn-secondary"
            style={{
              width: '100%',
              justifyContent: 'center',
              opacity: loading && loading !== 'github' ? 0.5 : 1,
              cursor: loading !== null ? 'not-allowed' : 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.1.39-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.64.71 1.03 1.61 1.03 2.71 0 3.84-2.34 4.69-4.57 4.94.36.31.69.92.69 1.85V21c0 .27.16.59.67.5A10 10 0 0 0 22 12 10 10 0 0 0 12 2z" />
            </svg>
            {loading === 'github' ? 'Signing in…' : 'Continue with GitHub'}
          </button>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading !== null}
            className="btn-secondary"
            style={{
              width: '100%',
              justifyContent: 'center',
              opacity: loading && loading !== 'google' ? 0.5 : 1,
              cursor: loading !== null ? 'not-allowed' : 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.3 9.14 5.38 12 5.38z" />
            </svg>
            {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
          </button>
        </div>

        <a
          href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          style={{
            fontSize: 13,
            color: 'var(--text-tertiary)',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Sign in with email →
        </a>

        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 20 }}>
          Free · No credit card required
        </p>
      </div>
    </div>
  );
}
