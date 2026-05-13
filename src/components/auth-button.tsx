'use client';

import Link from 'next/link';
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

export function AuthButton() {
  const authEnabled = useFeature('auth');
  const { data: session, status } = useSession();

  // When auth feature flag is off, still show a Sign in entry point that links to /login
  if (!authEnabled) {
    return (
      <Link href="/login" style={signInBtnStyle} aria-label="Sign in">
        <SignInIcon />
        Sign in
      </Link>
    );
  }

  if (status === 'loading') {
    return (
      <div
        style={{
          padding: '7px 14px',
          fontSize: 13,
          color: 'var(--text-tertiary)',
        }}
      >
        Loading...
      </div>
    );
  }

  if (session) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {session.user?.email}
        </span>
        <button
          onClick={() => signOut()}
          style={{
            padding: '7px 14px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            backgroundColor: 'var(--surface)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <Link href="/login" style={signInBtnStyle} aria-label="Sign in">
      <SignInIcon />
      Sign in
    </Link>
  );
}
