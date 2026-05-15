'use client';

import { useState } from 'react';

export function ResendButton() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const resend = async () => {
    setState('sending');
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' });
      setState(res.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  };

  if (state === 'sent') {
    return (
      <p style={{ fontSize: 'var(--fs-sm)', color: '#15803d', fontWeight: 500 }}>
        ✅ Email resent — check your inbox.
      </p>
    );
  }

  if (state === 'error') {
    return (
      <p style={{ fontSize: 'var(--fs-sm)', color: '#E11D48' }}>
        Could not resend — please try again in a moment.
      </p>
    );
  }

  return (
    <button
      onClick={resend}
      disabled={state === 'sending'}
      style={{
        background: 'none',
        border: 'none',
        cursor: state === 'sending' ? 'default' : 'pointer',
        color: 'var(--accent)',
        fontSize: 'var(--fs-sm)',
        fontWeight: 600,
        padding: 0,
        textDecoration: 'underline',
      }}
    >
      {state === 'sending' ? 'Sending…' : 'Resend verification email'}
    </button>
  );
}
