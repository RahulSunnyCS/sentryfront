import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Nav } from '@/components/nav';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });
  return {
    title: t('termsMetaTitle'),
    description: t('termsMetaDesc'),
    alternates: { canonical: `/${locale}/legal/terms` },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale: Locale) => ({ locale }));
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal' });
  const date = new Date().toLocaleDateString(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Nav />
      <div style={{ paddingTop: 56 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            {t('termsTitle')}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            {t('lastUpdated', { date })}
          </p>
          {locale !== 'en' && (
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-tertiary)',
                fontStyle: 'italic',
                marginBottom: 32,
                padding: '12px 14px',
                background: 'var(--surface-secondary)',
                borderLeft: '3px solid var(--accent)',
                borderRadius: 4,
              }}
            >
              {t('englishCanonicalNotice')}
            </p>
          )}

          <div className="legal-content" style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using VibeSafe (&quot;the Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;).
              If you do not agree to these Terms, do not use the Service.
            </p>

            <h2>2. Description of Service</h2>
            <p>
              VibeSafe is a security scanner designed to analyze publicly accessible websites and web applications
              for common security misconfigurations, vulnerabilities, and best practice violations.
            </p>

            <h3>2.1 Passive vs Active Scans</h3>
            <ul>
              <li><strong>Passive scans</strong> (default): Analyze publicly accessible content similar to a normal browser visit</li>
              <li><strong>Active scans</strong> (requires domain verification): May send additional probes and test requests</li>
              <li>Active scans are only available after domain ownership verification via DNS TXT record</li>
            </ul>

            <h2>3. Authorized Use and Prohibited Conduct</h2>

            <h3>3.1 You Must Have Permission</h3>
            <p>
              You may only scan websites, applications, or infrastructure that you own, operate, or have explicit written authorization to test.
            </p>

            <h3>3.2 Prohibited Targets</h3>
            <p>You are prohibited from scanning:</p>
            <ul>
              <li>Third-party websites without explicit written permission</li>
              <li>Government, military, or law enforcement websites</li>
              <li>Financial institutions, healthcare systems, or critical infrastructure</li>
              <li>Any target that prohibits automated scanning in their Terms of Service or robots.txt</li>
            </ul>

            <h3>3.3 Rate Limiting and Abuse</h3>
            <ul>
              <li>Scans are rate-limited per IP address and per user account</li>
              <li>Attempting to circumvent rate limits or perform distributed scanning is prohibited</li>
              <li>Excessive scanning or patterns indicating automated abuse will result in account termination</li>
            </ul>

            <h2>4. User Accounts and Tiers</h2>
            <p>
              VibeSafe offers multiple subscription tiers with different feature access levels.
              See our <Link href="/pricing">pricing page</Link> for current tier details.
            </p>

            <h2>5. Payment and Refunds</h2>
            <ul>
              <li>All paid subscriptions are billed monthly or as one-time payments</li>
              <li>Payments are processed securely through Stripe</li>
              <li>Refunds are issued at our sole discretion within 7 days of purchase</li>
              <li>You may cancel subscriptions at any time; cancellation takes effect at the end of the current billing period</li>
            </ul>

            <h2>6. Data and Privacy</h2>
            <p>
              Our collection and use of your personal information is described in our{' '}
              <Link href="/legal/privacy">Privacy Policy</Link>. Scan results may be retained for up to 30 days.
            </p>

            <h2>7. Disclaimers and Limitations</h2>

            <h3>7.1 No Certification or Guarantee</h3>
            <p>
              VibeSafe findings are informational and do not constitute a security certification, audit, or guarantee of security.
              The absence of findings does not mean a site is secure.
            </p>

            <h3>7.2 False Positives and Negatives</h3>
            <p>
              Automated security scanners may produce false positives (flagging benign code as vulnerable)
              and false negatives (missing actual vulnerabilities). Manual review is recommended.
            </p>

            <h3>7.3 Limitation of Liability</h3>
            <p>
              IN NO EVENT SHALL VIBESAFE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
              OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
            </p>

            <h2>8. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to the Service at any time,
              with or without notice, for violation of these Terms or for any other reason.
            </p>

            <h2>9. Contact</h2>
            <p>
              For questions about these Terms, contact us at:{' '}
              <Link href="/legal/contact">legal@vibesafe.app</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
