import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Payment successful',
  robots: { index: false, follow: false },
};

const TIER_NAME: Record<string, string> = {
  'one-shot': 'Verify',
  pro: 'Active Pack',
  studio: 'Monitor',
};

interface Props {
  searchParams: { test?: string; tier?: string; session_id?: string };
}

export default function CheckoutSuccessPage({ searchParams }: Props) {
  const isTest = searchParams.test === 'true';
  const tierLabel = searchParams.tier ? TIER_NAME[searchParams.tier] ?? searchParams.tier : null;

  return (
    <>
      <Nav />
      <div style={{ paddingTop: 'var(--nav-h)', display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <main
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-10) var(--space-4)',
          }}
        >
          <article
            style={{
              width: '100%',
              maxWidth: 520,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'clamp(24px, 5vw, 40px)',
              boxShadow: 'var(--shadow-md)',
              textAlign: 'center',
            }}
          >
            {isTest && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(245,158,11,0.15)',
                  color: '#B45309',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 'var(--space-4)',
                }}
              >
                Test mode · No charge
              </div>
            )}

            <div style={{ fontSize: 48, marginBottom: 'var(--space-3)' }} aria-hidden="true">
              ✅
            </div>
            <h1 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>
              {tierLabel ? `${tierLabel} activated` : 'You’re all set'}
            </h1>
            <p
              style={{
                fontSize: 'var(--fs-base)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-6)',
                lineHeight: 1.6,
              }}
            >
              {isTest
                ? 'Test bypass complete — your account was upgraded without a real charge. Use this flow to validate the upgrade UX before Stripe SKUs go live.'
                : 'Your purchase is complete. You can now run unlimited passive scans (or use your active testing credits) from the dashboard.'}
            </p>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/dashboard" className="btn-primary">
                Go to dashboard
              </Link>
              <Link href="/" className="btn-secondary">
                Start a scan
              </Link>
            </div>
          </article>
        </main>
        <Footer />
      </div>
    </>
  );
}
