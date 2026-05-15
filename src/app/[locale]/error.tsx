'use client';

import { useEffect } from 'react';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app error]', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
        backgroundColor: 'var(--bg)',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: '100%',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-8)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          style={{
            width: 48, height: 48,
            borderRadius: '50%',
            background: 'rgba(220,38,38,0.10)',
            border: '1px solid rgba(220,38,38,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
            margin: '0 auto var(--space-5)',
            color: '#DC2626',
            fontWeight: 700,
          }}
        >
          ✕
        </div>
        <h1 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
          An unexpected error occurred. Try again or go back to the home page.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={reset} className="btn-primary">
            Try again
          </button>
          <a href="/" className="btn-secondary" style={{ textDecoration: 'none' }}>
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
