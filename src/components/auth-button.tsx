'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initials = initialsFrom(name, email);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
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
          <img
            src={image}
            alt=""
            referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
            {initials}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: 240,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-md, 0 8px 24px rgba(0,0,0,0.12))',
            padding: 4,
            zIndex: 1100,
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
                style={{
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={email}
              >
                {email}
              </div>
            )}
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

          <Link
            href="/dashboard"
            role="menuitem"
            onClick={() => setOpen(false)}
            style={menuItemStyle}
          >
            {t('dashboard')}
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            style={{ ...menuItemStyle, width: '100%', textAlign: 'left' }}
          >
            {t('signOut')}
          </button>
        </div>
      )}
    </div>
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
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)' }} aria-hidden="true" />
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
