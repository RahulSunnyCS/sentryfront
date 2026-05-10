'use client';

import { useState } from 'react';
import { useFeature } from '@/lib/client-features';

interface Props {
  tier: 'one-shot' | 'pro' | 'studio';
  price: string;
  features: string[];
  highlighted?: boolean;
}

const tierLabels = {
  'one-shot': 'One-Shot Scan',
  pro: 'Pro',
  studio: 'Studio',
};

export function PricingCard({ tier, price, features, highlighted = false }: Props) {
  const stripeEnabled = useFeature('stripe');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!stripeEnabled) {
    return null; // Hide pricing if payments are disabled
  }

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Checkout failed' }));
        throw new Error(body.error || 'Checkout failed');
      }

      const data = await res.json();

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        border: highlighted ? '2px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 16,
        padding: 32,
        backgroundColor: highlighted ? 'var(--accent-light)' : 'var(--surface)',
        position: 'relative',
        boxShadow: highlighted ? 'var(--shadow-lg)' : 'var(--shadow-md)',
      }}
    >
      {highlighted && (
        <div
          style={{
            position: 'absolute',
            top: -12,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--accent)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: 20,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Popular
        </div>
      )}

      <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
        {tierLabels[tier]}
      </h3>

      <div style={{ marginBottom: 24 }}>
        <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)' }}>{price}</span>
        {tier !== 'one-shot' && (
          <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>/month</span>
        )}
      </div>

      <ul style={{ listStyle: 'none', padding: 0, marginBottom: 24 }}>
        {features.map((feature, i) => (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              marginBottom: 12,
              fontSize: 14,
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ color: 'var(--accent)', flexShrink: 0 }}>✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={handleCheckout}
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px 24px',
          borderRadius: 8,
          border: 'none',
          backgroundColor: highlighted ? 'var(--accent)' : 'var(--text)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Redirecting...' : `Get ${tierLabels[tier]}`}
      </button>

      {error && (
        <p style={{ fontSize: 12, color: '#e53e3e', marginTop: 12, textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  );
}
