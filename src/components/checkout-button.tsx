'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/toast';

type Tier = 'one-shot' | 'pro' | 'studio';

interface Props {
  tier: Tier;
  label: string;
  featured?: boolean;
}

interface TierDetail {
  name: string;
  price: string;
  cadence: string;
  features: string[];
}

const TIER_DETAILS: Record<Tier, TierDetail> = {
  'one-shot': {
    name: 'Verify',
    price: '$0',
    cadence: 'one-time',
    features: [
      '1 active DAST scan on a verified domain',
      'Real SQLi / XSS / auth-bypass probes',
      'Scan history retention',
      'No subscription, no card on file after',
    ],
  },
  pro: {
    name: 'Active Pack',
    price: '$0',
    cadence: 'one-time',
    features: [
      '5 active DAST scans',
      'Credits never expire',
      'Priority scan queue',
      'Scan history + PDF export',
    ],
  },
  studio: {
    name: 'Monitor',
    price: '$0',
    cadence: 'per month, per domain',
    features: [
      'Unlimited passive scans on the domain',
      'Daily auto-scan with regression alerts',
      'Scan diff + email/Slack notifications',
      'Cancel anytime',
    ],
  },
};

export function CheckoutButton({ tier, label, featured = false }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const detail = TIER_DETAILS[tier];
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = orig;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleConfirm = async () => {
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
      toast.error('Checkout failed. Please try again.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
          cursor: 'pointer',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
          marginBottom: 'var(--space-5)',
        }}
      >
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`checkout-${tier}-title`}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'var(--space-4)',
            animation: 'screenEnter 0.18s ease-out both',
          }}
        >
          <div
            style={{
              width: '100%', maxWidth: 460,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-lg)',
              padding: 'var(--space-6)',
              maxHeight: 'calc(100vh - 32px)',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)' }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>Confirm purchase</div>
                <h2 id={`checkout-${tier}-title`} className="text-h3" style={{ margin: 0 }}>
                  {detail.name} plan
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-secondary)',
                  fontSize: 18, lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Price row */}
            <div
              style={{
                display: 'flex', alignItems: 'baseline', gap: 8,
                padding: 'var(--space-4)',
                background: 'var(--surface-secondary)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-5)',
              }}
            >
              <span style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, color: 'var(--text)' }}>{detail.price}</span>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{detail.cadence}</span>
              {tier === 'studio' && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 10, fontWeight: 700,
                    padding: '3px 8px', borderRadius: 999,
                    background: 'var(--accent-light)', color: 'var(--accent)',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}
                >
                  Cancel anytime
                </span>
              )}
            </div>

            {/* Features */}
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-6)', display: 'grid', gap: 'var(--space-2)' }}>
              {detail.features.map((f) => (
                <li
                  key={f}
                  style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)',
                  }}
                >
                  <span aria-hidden="true" style={{ color: 'var(--accent)', fontWeight: 800, flexShrink: 0 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {/* Actions */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', marginBottom: 'var(--space-3)', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Redirecting to secure checkout…' : `Continue to secure checkout →`}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="btn-secondary"
              style={{ width: '100%' }}
            >
              Cancel
            </button>

            {/* Trust footer */}
            <div
              style={{
                marginTop: 'var(--space-5)',
                paddingTop: 'var(--space-4)',
                borderTop: '1px solid var(--border)',
                display: 'flex', justifyContent: 'center', gap: 16,
                fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)',
                flexWrap: 'wrap',
              }}
            >
              <span><span aria-hidden="true">🔒</span> Secured by Stripe</span>
              <span><span aria-hidden="true">↩</span> 14-day refund</span>
              <span><span aria-hidden="true">🛡</span> PCI-DSS compliant</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
