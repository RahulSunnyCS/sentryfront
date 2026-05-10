'use client';

import { useFeature } from '@/lib/client-features';

interface Props {
  isLimited: boolean;
  tier: string;
  total: number;
  shown: number;
  hiddenCount?: number;
}

export function TierGateBanner({ isLimited, tier, total, shown, hiddenCount }: Props) {
  const tierGatingEnabled = useFeature('tierGating');
  const stripeEnabled = useFeature('stripe');

  // Don't show banner if tier gating is disabled or if not limited
  if (!tierGatingEnabled || !isLimited) {
    return null;
  }

  const handleUpgrade = () => {
    // TODO: Navigate to pricing page when implemented
    window.location.href = '/pricing';
  };

  return (
    <div
      style={{
        backgroundColor: '#fffbeb',
        border: '2px solid #fbbf24',
        borderRadius: 12,
        padding: '20px 24px',
        marginBottom: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
          {tier === 'free' ? '🔒 Free Tier Limitations' : '⚠️ Limited Access'}
        </div>
        <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>
          {tier === 'free' ? (
            <>
              Showing <strong>{shown} of {total} findings</strong>. 
              {hiddenCount && hiddenCount > 0 && (
                <> <strong>{hiddenCount} critical findings are hidden</strong>.</>
              )}
              {' '}Upgrade to Pro to see all security issues.
            </>
          ) : (
            <>Your current tier shows limited results. Upgrade for full access.</>
          )}
        </div>
      </div>

      {stripeEnabled && (
        <button
          onClick={handleUpgrade}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: '#f59e0b',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#d97706';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f59e0b';
          }}
        >
          Upgrade to Pro
        </button>
      )}
    </div>
  );
}
