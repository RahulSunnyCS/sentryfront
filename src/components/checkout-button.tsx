'use client';

import { useState } from 'react';

interface Props {
  tier: 'one-shot' | 'pro' | 'studio';
  label: string;
  featured?: boolean;
}

export function CheckoutButton({ tier, label, featured = false }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      style={{
        width: '100%',
        padding: '12px 16px',
        minHeight: 44,
        background: featured ? 'var(--accent)' : 'var(--surface-secondary)',
        border: featured ? 'none' : '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--fs-base)',
        fontWeight: 700,
        color: featured ? '#fff' : 'var(--text)',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
        opacity: loading ? 0.7 : 1,
        marginBottom: 'var(--space-5)',
      }}
    >
      {loading ? 'Redirecting…' : label}
    </button>
  );
}
