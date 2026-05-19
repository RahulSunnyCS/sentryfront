'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface PaymentModalContextValue {
  openModal: () => void;
  closeModal: () => void;
}

const PaymentModalContext = createContext<PaymentModalContextValue | null>(null);

export function usePaymentModal(): PaymentModalContextValue {
  const ctx = useContext(PaymentModalContext);
  if (!ctx) throw new Error('usePaymentModal must be used inside PaymentModalProvider');
  return ctx;
}

const PLANS = [
  {
    tier: 'one-shot' as const,
    name: 'One-Shot',
    price: '$9',
    cadence: 'one-time',
    badge: null,
    features: [
      '1 active DAST scan on a verified domain',
      'Real SQLi / XSS / auth-bypass probes',
      'Scan history retention',
      'No subscription required',
    ],
  },
  {
    tier: 'pro' as const,
    name: 'Active Pack',
    price: '$29',
    cadence: 'one-time',
    badge: 'Most popular',
    features: [
      '5 active DAST scans',
      'Credits never expire',
      'Priority scan queue',
      'Scan history + PDF export',
    ],
  },
  {
    tier: 'studio' as const,
    name: 'Monitor',
    price: '$19',
    cadence: 'per month',
    badge: 'Cancel anytime',
    features: [
      'Unlimited passive scans on the domain',
      'Daily auto-scan with regression alerts',
      'Scan diff + email/Slack notifications',
      'Dedicated support',
    ],
  },
];

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
}

function PaymentModalUI({ open, onClose }: PaymentModalProps) {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = orig;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleCheckout = async (tier: string) => {
    if (loadingTier) return;
    setLoadingTier(tier);
    try {
      const res = await fetch('/api/v1/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json() as { url?: string };
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setLoadingTier(null);
      }
    } catch {
      setLoadingTier(null);
    }
  };

  return (
    <div
      data-testid="payment-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-4)',
        animation: 'screenEnter 0.18s ease-out both',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 640,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          padding: 'var(--space-6)',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Upgrade required</div>
            <h2 id="payment-modal-title" className="text-h3" style={{ margin: 0 }}>
              You&apos;ve used your free scan
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              width: 32, height: 32, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-secondary)',
              fontSize: 18, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-5)', lineHeight: 1.6 }}>
          Pick a plan to keep scanning. Credits never expire — use them whenever you need.
        </p>

        {/* Plan cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          {PLANS.map((plan) => {
            const isFeatured = plan.tier === 'pro';
            return (
              <div
                key={plan.tier}
                style={{
                  position: 'relative',
                  padding: 'var(--space-4)',
                  background: isFeatured ? 'rgba(13,148,136,0.08)' : 'var(--surface-secondary)',
                  border: `1px solid ${isFeatured ? 'rgba(13,148,136,0.40)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
                }}
              >
                {plan.badge && (
                  <span style={{
                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 10, fontWeight: 700,
                    padding: '2px 10px', borderRadius: 999,
                    background: isFeatured ? 'var(--accent)' : 'var(--surface-secondary)',
                    color: isFeatured ? '#fff' : 'var(--text-secondary)',
                    border: isFeatured ? 'none' : '1px solid var(--border)',
                    whiteSpace: 'nowrap',
                  }}>
                    {plan.badge}
                  </span>
                )}
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)' }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text)' }}>{plan.price}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{plan.cadence}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => handleCheckout(plan.tier)}
                  disabled={loadingTier !== null}
                  className={isFeatured ? 'btn-primary' : 'btn-secondary'}
                  style={{ width: '100%', opacity: loadingTier && loadingTier !== plan.tier ? 0.5 : 1 }}
                >
                  {loadingTier === plan.tier ? 'Redirecting…' : 'Get started →'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ fontSize: 'var(--fs-sm)' }}
          >
            Maybe later
          </button>
          <div style={{
            display: 'flex', gap: 16,
            fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)',
          }}>
            <span>🔒 Secured by Stripe</span>
            <span>↩ 14-day refund</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PaymentModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  return (
    <PaymentModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      <PaymentModalUI open={open} onClose={closeModal} />
    </PaymentModalContext.Provider>
  );
}

// ─── Timed upsell for report page ────────────────────────────────────────────
// Shows an upgrade modal after a delay to free/unauthenticated users.

export function ReportUpsellTimer({ delayMs = 12000 }: { delayMs?: number }) {
  const { openModal } = usePaymentModal();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    const id = setTimeout(() => {
      if (!fired.current) {
        fired.current = true;
        openModal();
      }
    }, delayMs);
    return () => clearTimeout(id);
  }, [openModal, delayMs]);

  return null;
}
