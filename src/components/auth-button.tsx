'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useFeature } from '@/lib/client-features';
import { LocaleSwitcher } from './locale-switcher';
import { ThemeToggle } from './theme-toggle';

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

// Shared label style for the preference rows in the user menu. The real
// LocaleSwitcher/ThemeToggle components carry their own control styling and
// data-testid — we only add a small label beside each so the menu stays
// self-explanatory (the standalone components have no visible text label).
const prefRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '8px 12px',
  fontSize: 13,
  color: 'var(--text-secondary)',
};

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
  const tLocale = useTranslations('localeSwitcher');
  const tTheme = useTranslations('theme');
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

      {/* Real LocaleSwitcher / ThemeToggle (replaces the former fake
          PreferenceRows). These are the same components used in the
          signed-out navbar — single source of truth, no reimplementation,
          and they carry the data-testids the E2E suite asserts. */}
      <div style={prefRowStyle}>
        <span>{tLocale('label')}</span>
        <LocaleSwitcher />
      </div>
      <div style={prefRowStyle}>
        <span>{tTheme('label')}</span>
        <ThemeToggle />
      </div>

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
