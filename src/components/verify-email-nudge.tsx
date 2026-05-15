'use client';

import { useSession } from 'next-auth/react';
import { Link } from '@/i18n/navigation';

export function VerifyEmailNudge() {
  const { data: session, status } = useSession();
  if (status !== 'authenticated') return null;

  const verified = (session?.user as { emailVerified?: boolean } | null)?.emailVerified;
  if (verified) return null;

  return (
    <Link
      href="/verify-email-sent"
      title="Verify your email address"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 20,
        background: '#fef3c7',
        border: '1px solid #fcd34d',
        color: '#92400e',
        fontSize: 12,
        fontWeight: 600,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <span aria-hidden="true">✉️</span>
      {/* Hide label text on very small screens — icon + tooltip still communicates intent */}
      <span style={{ display: 'var(--nudge-label-display, inline)' }}>Verify email</span>
    </Link>
  );
}
