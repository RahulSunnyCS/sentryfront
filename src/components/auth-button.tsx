'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { useFeature } from '@/lib/client-features';

export function AuthButton() {
  const authEnabled = useFeature('auth');
  const { data: session, status } = useSession();

  if (!authEnabled) {
    return null; // Hide auth UI when disabled
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
    <button
      onClick={() => signIn()}
      style={{
        padding: '7px 14px',
        borderRadius: 8,
        border: 'none',
        backgroundColor: 'var(--accent)',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      Sign in
    </button>
  );
}
