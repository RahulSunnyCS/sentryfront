'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations, useLocale } from 'next-intl';
import { useParams } from 'next/navigation';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { signOut, useSession } from 'next-auth/react';
import { useFeature } from '@/lib/client-features';

const SignInIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

const signInBtnStyle: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 8,
  border: 'none',
  backgroundColor: 'var(--accent)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  textDecoration: 'none',
};

function initialsFrom(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0]?.toUpperCase() ?? '?';
  }
  if (email) return email[0]?.toUpperCase() ?? '?';
  return '?';
}

const prefRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '8px 12px',
  fontSize: 13,
  color: 'var(--text-secondary)',
  border: 'none',
  background: 'transparent',
  borderRadius: 6,
  cursor: 'pointer',
};

const prefValueStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
};

function PreferenceRows() {
  const tLocale = useTranslations('localeSwitcher');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    setIsDark(document.documentElement.getAttribute('data-theme') !== 'light');
  }, []);

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    localStorage.setItem('theme', next);
    if (next === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const onLocale = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as Locale;
    startTransition(() => {
      router.replace(
        // @ts-expect-error -- pathname signature varies per route; next-intl handles it
        { pathname, params },
        { locale: next },
      );
    });
  };

  return (
    <>
      <button
        type="button"
        role="menuitem"
        onClick={toggleTheme}
        style={prefRowStyle}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in srgb, var(--border) 40%, transparent)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span>Theme</span>
        <span style={prefValueStyle}>
          <span aria-hidden="true">{isDark ? '🌙' : '☀️'}</span>
          {isDark ? 'Dark' : 'Light'}
        </span>
      </button>

      <div
        style={{ position: 'relative' }}
        onMouseEnter={(e) => (e.currentTarget.firstElementChild as HTMLElement).style.background = 'color-mix(in srgb, var(--border) 40%, transparent)'}
        onMouseLeave={(e) => (e.currentTarget.firstElementChild as HTMLElement).style.background = 'transparent'}
      >
        <div style={prefRowStyle}>
          <span>{tLocale('label')}</span>
          <span style={prefValueStyle}>
            {tLocale(locale)}
            <span aria-hidden="true" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>▾</span>
          </span>
        </div>
        <select
          value={locale}
          onChange={onLocale}
          disabled={isPending}
          aria-label={tLocale('label')}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            border: 'none',
          }}
        >
          {routing.locales.map((l) => (
            <option key={l} value={l}>
              {tLocale(l)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

function UserMenu({
  name,
  email,
  image,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}) {
  const t = useTranslations('auth');
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const initials = initialsFrom(name, email);

  const dropdown = open ? (
    <div
      // Full-screen backdrop: closes the menu on any outside tap.
      // z-index: 10001 - above mobile nav menu (8000), chat widget (9999),
      // and even payment modals (10000) since auth is critical
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        background: 'rgba(0,0,0,0.35)',
      }}
    >
    <div
      id="user-menu-portal"
      role="menu"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: 'calc(var(--nav-h) + 8px)',
        right: 12,
        width: 'min(280px, calc(100vw - 24px))',
        maxHeight: 'calc(100dvh - var(--nav-h) - 24px)',
        overflowY: 'auto',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
        padding: 4,
      }}
    >
      <div style={{ padding: '10px 12px' }}>
        {name && (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
            {name}
          </div>
        )}
        {email && (
          <div
            style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={email}
          >
            {email}
          </div>
        )}
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

      <Link href="/dashboard" role="menuitem" onClick={() => setOpen(false)} style={menuItemStyle}>
        {t('dashboard')}
      </Link>

      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

      <PreferenceRows />

      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

      <button
        type="button"
        role="menuitem"
        onClick={() => { setOpen(false); signOut(); }}
        style={{ ...menuItemStyle, width: '100%', textAlign: 'left' }}
      >
        {t('signOut')}
      </button>
    </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('accountMenu')}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: '1px solid var(--border)',
          padding: 0,
          backgroundColor: 'var(--surface)',
          cursor: 'pointer',
          overflow: 'hidden',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{initials}</span>
        )}
      </button>
      {typeof document !== 'undefined' && dropdown && createPortal(dropdown, document.body)}
    </>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  padding: '8px 12px',
  fontSize: 13,
  color: 'var(--text-secondary)',
  textDecoration: 'none',
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
};

export function MobileAuthSection() {
  const t = useTranslations('auth');
  const authEnabled = useFeature('auth');
  const { data: session, status } = useSession();

  if (!authEnabled) {
    return (
      <Link href="/login" style={signInBtnStyle} aria-label={t('signIn')}>
        <SignInIcon />
        {t('signIn')}
      </Link>
    );
  }

  if (status === 'loading') {
    return <div style={{ height: 40 }} />;
  }

  if (!session) {
    return (
      <Link href="/login" style={signInBtnStyle} aria-label={t('signIn')}>
        <SignInIcon />
        {t('signIn')}
      </Link>
    );
  }

  const { name, email, image } = session.user ?? {};
  const initials = initialsFrom(name, email);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>{initials}</span>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          {name && <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{name}</div>}
          {email && (
            <div
              style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={email}
            >
              {email}
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

      <Link href="/dashboard" style={menuItemStyle}>
        {t('dashboard')}
      </Link>

      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

      <PreferenceRows />

      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

      <button
        type="button"
        onClick={() => signOut()}
        style={{ ...menuItemStyle, width: '100%', textAlign: 'left' }}
      >
        {t('signOut')}
      </button>
    </div>
  );
}

export function AuthButton() {
  const t = useTranslations('auth');
  const authEnabled = useFeature('auth');
  const { data: session, status } = useSession();

  if (!authEnabled) {
    return (
      <Link href="/login" style={signInBtnStyle} aria-label={t('signIn')}>
        <SignInIcon />
        {t('signIn')}
      </Link>
    );
  }

  if (status === 'loading') {
    return (
      <div
        role="status"
        aria-label="Validating session"
        title="Validating session…"
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'transparent',
          border: '2px solid var(--border)',
          borderTopColor: 'var(--accent)',
          animation: 'spin 0.8s linear infinite',
          flexShrink: 0,
        }}
      />
    );
  }

  if (session) {
    return (
      <UserMenu
        name={session.user?.name}
        email={session.user?.email}
        image={session.user?.image}
      />
    );
  }

  return (
    <Link href="/login" style={signInBtnStyle} aria-label={t('signIn')}>
      <SignInIcon />
      {t('signIn')}
    </Link>
  );
}
