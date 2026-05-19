'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter, Link } from '@/i18n/navigation';
import { signIn } from 'next-auth/react';
import { Logo } from '@/components/logo';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: () => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'small' | 'medium' | 'large';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number | string;
            },
          ) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID_FROM_ENV = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

function sanitizeCallback(raw: string | null): string {
  if (!raw) return '/dashboard';
  if (!raw.startsWith('/')) return '/dashboard';
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/dashboard';
  return raw;
}

export function LoginCard({ googleClientId }: { googleClientId?: string }) {
  const t = useTranslations('login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallback(
    searchParams?.get('callbackUrl') ?? searchParams?.get('next') ?? null,
  );

  const clientId = googleClientId || GOOGLE_CLIENT_ID_FROM_ENV;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<null | 'github' | 'google' | 'email'>(null);
  const [error, setError] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement | null>(null);

  const handleGoogleCredential = useCallback(
    async (response: { credential: string }) => {
      setError(null);
      setLoading('google');
      try {
        const res = await fetch('/api/auth/google-one-tap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: response.credential }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: t('signInFailedGeneric') }));
          throw new Error(body.error || t('signInFailedGeneric'));
        }
        router.push(callbackUrl);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t('signInFailedGeneric'));
        setLoading(null);
      }
    },
    [callbackUrl, router, t],
  );

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;
    const interval = setInterval(() => {
      if (cancelled) return;
      if (!window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
        cancel_on_tap_outside: true,
      });

      if (googleBtnRef.current) {
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: googleBtnRef.current.offsetWidth || 360,
        });
      }

      window.google.accounts.id.prompt();
      clearInterval(interval);
    }, 200);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [handleGoogleCredential, clientId]);

  const handleGithubPopup = () => {
    setError(null);

    const width = 520;
    const height = 640;
    const left =
      typeof window !== 'undefined'
        ? Math.max(0, window.screenX + (window.outerWidth - width) / 2)
        : 0;
    const top =
      typeof window !== 'undefined'
        ? Math.max(0, window.screenY + (window.outerHeight - height) / 2)
        : 0;

    const popupCallback = `${window.location.origin}/auth/popup-callback`;
    const signInUrl = `/auth/popup-start?provider=github&callbackUrl=${encodeURIComponent(popupCallback)}`;

    const popup = window.open(
      signInUrl,
      'github-oauth',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
    );

    if (!popup) {
      signIn('github', { callbackUrl });
      return;
    }

    setLoading('github');

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string } | null)?.type !== 'oauth-complete') return;

      window.removeEventListener('message', onMessage);
      clearInterval(closeWatcher);
      try {
        popup.close();
      } catch {
        // ignore
      }
      router.push(callbackUrl);
      router.refresh();
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

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading('email');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t('invalidCreds'));
        setLoading(null);
        return;
      }
      window.location.href = callbackUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('signInFailedGeneric'));
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
          <Logo size={28} />
        </div>
        <h1 className="text-h3" style={{ marginBottom: 'var(--space-2)' }}>
          {t('welcomeBack')}
        </h1>
        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)' }}>
          {t('welcomeLead')}
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <GithubButton
          loading={loading === 'github'}
          disabled={loading !== null}
          onClick={handleGithubPopup}
          loadingLabel={t('signingIn')}
          label={t('continueWithGithub')}
        />
        {clientId ? (
          <div
            ref={googleBtnRef}
            style={{
              display: 'flex',
              justifyContent: 'center',
              minHeight: 44,
            }}
            aria-label={t('continueWithGoogleAria')}
          />
        ) : (
          <FallbackGoogleButton
            loading={loading === 'google'}
            disabled={loading !== null}
            onClick={() => signIn('google', { callbackUrl })}
            loadingLabel={t('redirecting')}
            label={t('continueWithGoogle')}
          />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', margin: 'var(--space-6) 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('or')}</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      <form data-testid="login-form" onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div>
          <label htmlFor="email" style={labelCss}>{t('emailLabel')}</label>
          <input
            id="email"
            data-testid="login-email-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            className="field"
            disabled={loading !== null}
          />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <label htmlFor="password" style={labelCss}>{t('passwordLabel')}</label>
            <a
              href="#"
              style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent)', fontWeight: 600 }}
            >
              {t('forgot')}
            </a>
          </div>
          <input
            id="password"
            data-testid="login-password-input"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('passwordPlaceholder')}
            className="field"
            disabled={loading !== null}
          />
        </div>

        {error && (
          <p data-testid="login-error" role="alert" style={{ fontSize: 'var(--fs-sm)', color: '#E11D48' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          data-testid="login-submit"
          className="btn-primary"
          disabled={loading !== null}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {loading === 'email' ? t('signingIn') : t('signIn')}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
        {t('dontHaveAccount')}{' '}
        <Link href="/signup" style={{ color: 'var(--accent)', fontWeight: 600 }}>
          {t('signUpFree')}
        </Link>
      </p>

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
          { label: t('badgeSoc'), icon: '🛡️' },
          { label: t('badgeSsl'), icon: '🔒' },
          { label: t('badgeFree'), icon: '🎁' },
        ].map((badge) => (
          <li key={badge.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 500 }}>
            <span aria-hidden="true">{badge.icon}</span>
            {badge.label}
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

function GithubButton({
  loading,
  disabled,
  onClick,
  loadingLabel,
  label,
}: {
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  loadingLabel: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn-secondary"
      style={{
        width: '100%',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !loading ? 0.6 : 1,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.1.39-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.64.71 1.03 1.61 1.03 2.71 0 3.84-2.34 4.69-4.57 4.94.36.31.69.92.69 1.85V21c0 .27.16.59.67.5A10 10 0 0 0 22 12 10 10 0 0 0 12 2z" />
      </svg>
      {loading ? loadingLabel : label}
    </button>
  );
}

function FallbackGoogleButton({
  loading,
  disabled,
  onClick,
  loadingLabel,
  label,
}: {
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  loadingLabel: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn-secondary"
      style={{
        width: '100%',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !loading ? 0.6 : 1,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.3 9.14 5.38 12 5.38z" />
      </svg>
      {loading ? loadingLabel : label}
    </button>
  );
}
