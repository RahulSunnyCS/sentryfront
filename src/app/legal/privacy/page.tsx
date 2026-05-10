import { Nav } from '@/components/nav';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — VibeSafe',
  description: 'Privacy Policy for VibeSafe security scanner',
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Nav />
      <div style={{ paddingTop: 56 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 48 }}>
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <div className="legal-content" style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            <h2>1. Information We Collect</h2>

            <h3>1.1 Account Information</h3>
            <ul>
              <li>Email address (when you create an account)</li>
              <li>Name and profile information (if provided)</li>
              <li>Payment information (processed securely by Stripe)</li>
            </ul>

            <h3>1.2 Scan Data</h3>
            <ul>
              <li>Target URLs you submit for scanning</li>
              <li>Scan results, findings, and security reports</li>
              <li>Redacted evidence of security issues (secrets are masked)</li>
              <li>HTTP headers, cookies, and DOM snapshots collected during scans</li>
            </ul>

            <h3>1.3 Usage Data</h3>
            <ul>
              <li>IP addresses, browser type, and device information</li>
              <li>Pages viewed, features used, and scan frequency</li>
              <li>Error logs and performance metrics</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul>
              <li>Provide and improve the security scanning service</li>
              <li>Generate security reports and recommendations</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send service updates and security alerts</li>
              <li>Detect and prevent abuse, fraud, and unauthorized access</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2>3. AI and LLM Processing</h2>
            <p>
              When enabled, we use Anthropic&apos;s Claude API to enrich scan findings with explanations and fix recommendations. 
              Data sent to the LLM includes:
            </p>
            <ul>
              <li>Target URL (domain only, no full paths or query parameters)</li>
              <li>Stack/framework detection results</li>
              <li>Redacted security findings (secrets are masked before sending)</li>
            </ul>
            <p>
              Anthropic does not train models on data sent via API. See Anthropic&apos;s{' '}
              <a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noopener noreferrer">
                commercial terms
              </a>{' '}
              for details.
            </p>

            <h2>4. Data Sharing and Third Parties</h2>
            <p>We share data with the following third-party services:</p>

            <h3>4.1 Service Providers</h3>
            <ul>
              <li><strong>Stripe</strong>: Payment processing (see Stripe&apos;s Privacy Policy)</li>
              <li><strong>Cloudflare R2</strong>: PDF report storage (encrypted at rest)</li>
              <li><strong>Anthropic</strong>: LLM-powered finding enrichment (optional, when enabled)</li>
              <li><strong>Sentry</strong>: Error tracking and monitoring (when enabled)</li>
            </ul>

            <h3>4.2 We Do Not Sell Your Data</h3>
            <p>
              We do not sell, rent, or trade your personal information to third parties for marketing purposes.
            </p>

            <h2>5. Data Retention</h2>
            <ul>
              <li><strong>Account data</strong>: Retained while your account is active, plus 90 days after closure</li>
              <li><strong>Scan results</strong>: Retained for 30 days by default (configurable in account settings)</li>
              <li><strong>Logs and analytics</strong>: Retained for 90 days</li>
              <li><strong>Payment records</strong>: Retained for 7 years for tax and legal compliance</li>
            </ul>

            <h2>6. Data Security</h2>
            <p>We protect your data using:</p>
            <ul>
              <li>Encryption in transit (TLS 1.2+)</li>
              <li>Encryption at rest for database and file storage</li>
              <li>Automatic secret redaction (first/last 4 characters only)</li>
              <li>Access controls and audit logging</li>
              <li>Regular security audits and vulnerability scanning</li>
            </ul>

            <h2>7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access your personal information and scan data</li>
              <li>Request corrections to inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Export your scan results in PDF or JSON format</li>
              <li>Opt out of LLM enrichment (disable in account settings)</li>
              <li>Withdraw consent for data processing</li>
            </ul>
            <p>
              To exercise these rights, contact us at <Link href="/legal/contact">privacy@vibesafe.app</Link>
            </p>

            <h2>8. Children&apos;s Privacy</h2>
            <p>
              VibeSafe is not intended for users under 13 years of age. We do not knowingly collect personal information from children.
            </p>

            <h2>9. International Data Transfers</h2>
            <p>
              Your data may be processed in the United States and other countries where our service providers operate. 
              We ensure appropriate safeguards are in place for international data transfers.
            </p>

            <h2>10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant changes via email or service announcement.
            </p>

            <h2>11. Contact</h2>
            <p>
              For privacy questions or to exercise your rights, contact:{' '}
              <Link href="/legal/contact">privacy@vibesafe.app</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
