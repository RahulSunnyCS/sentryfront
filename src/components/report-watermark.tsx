'use client';

import { useFeature } from '@/lib/client-features';

interface Props {
  tier: string;
  isLimited: boolean;
}

export function ReportWatermark({ tier, isLimited }: Props) {
  const tierGatingEnabled = useFeature('tierGating');

  // Only show watermark for free tier when tier gating is enabled
  if (!tierGatingEnabled || tier !== 'free' || !isLimited) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        zIndex: 50,
        boxShadow: 'var(--shadow-xl)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 16 }}>🔒</span>
      <span>Free Tier • Limited Results</span>
    </div>
  );
}
