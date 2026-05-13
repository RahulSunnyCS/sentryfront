import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { VerifyFlow } from './verify-flow';

export const metadata: Metadata = {
  title: 'Verify domain ownership',
  description:
    'Verify ownership of a domain before running active security tests. Choose DNS TXT record or HTML meta tag — or use our guided walkthrough for Wix, Squarespace, Webflow, Framer, Shopify, WordPress, Cloudflare, Vercel.',
  alternates: { canonical: '/verify' },
  robots: { index: false, follow: false },
};

export default function VerifyPage() {
  return (
    <>
      <Nav />
      <div style={{ paddingTop: 'var(--nav-h)' }}>
        <main className="section">
          <div className="container">
            <header style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-xl)',
                  background: 'rgba(220,38,38,0.10)',
                  color: '#DC2626',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <span aria-hidden="true" className="pulse-soft">●</span>
                Required for active testing
              </div>
              <h1 className="text-h2" style={{ marginBottom: 'var(--space-3)' }}>
                Verify you own this domain
              </h1>
              <p className="text-lead" style={{ maxWidth: 640, margin: '0 auto' }}>
                Active security tests send real attack probes. We require proof of ownership to keep your scans
                legal under CFAA and to make sure no one else gets to break your site for you.
              </p>
            </header>

            <VerifyFlow domain="taskflow.app" token="vibesafe-verify=a7f3c2e1d4b8" />
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
