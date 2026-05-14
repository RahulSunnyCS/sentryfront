'use client';

import { useEffect } from 'react';

export default function PopupCallback() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(
          { type: 'oauth-complete' },
          window.location.origin,
        );
      } catch {
        // ignore — fall through to close
      }
      window.close();
      return;
    }

    // Opened directly (popup blocked or refreshed): send the user on.
    window.location.href = '/dashboard';
  }, []);

  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 24,
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <p>Signing you in…</p>
    </main>
  );
}
