import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { getCurrentUser } from '@/lib/auth/helpers';
import { getOrCreateVerification, normalizeDomain, TOKEN_PREFIX } from '@/lib/verify-domain';
import { ValidationError } from '@/lib/url-validator';
import { logger } from '@/lib/logger';
import { VerifyFlow } from './verify-flow';
import { DomainEntry } from './domain-entry';

export const metadata: Metadata = {
  title: 'Verify domain ownership',
  description:
    'Verify ownership of a domain before running active security tests. Choose DNS TXT record or HTML meta tag — or use our guided walkthrough.',
  alternates: { canonical: '/verify' },
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface VerifyPageProps {
  searchParams?: { domain?: string | string[] };
}

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/verify');
  }

  const rawDomain = Array.isArray(searchParams?.domain)
    ? searchParams?.domain[0]
    : searchParams?.domain;

  let domain: string | null = null;
  let domainError: string | null = null;
  if (rawDomain) {
    try {
      domain = normalizeDomain(rawDomain);
    } catch (err) {
      if (err instanceof ValidationError) domainError = err.message;
      else throw err;
    }
  }

  let token: string | null = null;
  let alreadyVerified = false;
  if (domain) {
    try {
      const record = await getOrCreateVerification(user.id, domain);
      token = `${TOKEN_PREFIX}${record.token}`;
      alreadyVerified = record.verifiedAt !== null;
    } catch (err) {
      logger.error('Verify token init failed', { userId: user.id, domain }, err as Error);
      domainError = 'We couldn\'t initialize verification. Please try again.';
      domain = null;
    }
  }

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

            {domain && token ? (
              <VerifyFlow
                domain={domain}
                token={token}
                alreadyVerified={alreadyVerified}
              />
            ) : (
              <DomainEntry error={domainError} initialDomain={rawDomain ?? ''} />
            )}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
