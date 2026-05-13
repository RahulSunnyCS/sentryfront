'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { IconShield } from '@/components/icons';

export function LoginCard() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<null | 'github' | 'google' | 'email'>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOAuth = async (provider: 'github' | 'google') => {
    setError(null);
    setLoading(provider);
    try {
      await signIn(provider, { callbackUrl: '/dashboard' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
      setLoading(null);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading('email');
    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
        callbackUrl: '/dashboard',
      });
      if (result?.error) {
        setError('Invalid credentials');
        setLoading(null);
        return;
      }
      window.location.href = result?.url ?? '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setLoading(null);
    }
  };

  return (
    <article
      style={{
        width: '100%',
        maxWidth: 440,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'clamp(24px, 5vw, 40px)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <header style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-4)' }}>
          <IconShield size={28} color="var(--accent)" />
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>VibeSafe</span>
        </div>
        <h1 className="text-h3" style={{ marginBottom: 'var(--space-2)' }}>
          Welcome back
        </h1>
        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)' }}>
          Sign in to start scanning your sites
        </p>
      </header>

      {/* OAuth */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <OAuthButton provider="github" loading={loading === 'github'} disabled={loading !== null} onClick={() => handleOAuth('github')} />
        <OAuthButton provider="google" loading={loading === 'google'} disabled={loading !== null} onClick={() => handleOAuth('google')} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', margin: 'var(--space-6) 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>or</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      {/* Email form */}
      <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div>
          <label htmlFor="email" style={labelCss}>Email</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="field"
            disabled={loading !== null}
          />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <label htmlFor="password" style={labelCss}>Password</label>
            <a
              href="#"
              style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent)', fontWeight: 600 }}
            >
              Forgot?
            </a>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="field"
            disabled={loading !== null}
          />
        </div>

        {error && (
          <p role="alert" style={{ fontSize: 'var(--fs-sm)', color: '#E11D48' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={loading !== null}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {loading === 'email' ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
        Don&apos;t have an account?{' '}
        <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>
          Sign up for free
        </Link>
      </p>

      {/* Trust badges */}
      <ul
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-5)',
          flexWrap: 'wrap',
          listStyle: 'none',
          padding: 'var(--space-6) 0 0',
          margin: 'var(--space-6) 0 0',
          borderTop: '1px solid var(--border)',
        }}
      >
        {[
          { label: 'SOC 2 ready', icon: '🛡️' },
          { label: '256-bit SSL', icon: '🔒' },
          { label: 'Free tier', icon: '🎁' },
        ].map((t) => (
          <li key={t.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 500 }}>
            <span aria-hidden="true">{t.icon}</span>
            {t.label}
          </li>
        ))}
      </ul>
    </article>
  );
}

const labelCss: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--fs-sm)',
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: 'var(--space-2)',
};

function OAuthButton({
  provider,
  loading,
  disabled,
  onClick,
}: {
  provider: 'github' | 'google';
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const isGithub = provider === 'github';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn-secondary"
      style={{ width: '100%', justifyContent: 'center', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled && !loading ? 0.6 : 1 }}
    >
      {isGithub ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.1.39-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.64.71 1.03 1.61 1.03 2.71 0 3.84-2.34 4.69-4.57 4.94.36.31.69.92.69 1.85V21c0 .27.16.59.67.5A10 10 0 0 0 22 12 10 10 0 0 0 12 2z" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.3 9.14 5.38 12 5.38z" />
        </svg>
      )}
      {loading ? 'Redirecting…' : `Continue with ${isGithub ? 'GitHub' : 'Google'}`}
    </button>
  );
}
