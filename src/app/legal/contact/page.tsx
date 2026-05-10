import { Nav } from '@/components/nav';

export const metadata = {
  title: 'Contact Legal — VibeSafe',
  description: 'Contact information for legal, privacy, and abuse inquiries',
};

export default function ContactPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Nav />
      <div style={{ paddingTop: 56 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            Legal Contact
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 48, lineHeight: 1.6 }}>
            For legal, privacy, security, or abuse inquiries, please contact us at the appropriate email address below.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                📧 General Legal Inquiries
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Terms of Service, licensing, partnerships, and general legal questions
              </p>
              <a
                href="mailto:legal@vibesafe.app"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  textDecoration: 'none',
                }}
              >
                legal@vibesafe.app
              </a>
            </div>

            <div style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                🔒 Privacy and Data Requests
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
                GDPR/CCPA requests, data deletion, access requests, and privacy concerns
              </p>
              <a
                href="mailto:privacy@vibesafe.app"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  textDecoration: 'none',
                }}
              >
                privacy@vibesafe.app
              </a>
            </div>

            <div style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                🛡️ Security Vulnerabilities
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Responsible disclosure of security vulnerabilities in VibeSafe itself
              </p>
              <a
                href="mailto:security@vibesafe.app"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  textDecoration: 'none',
                }}
              >
                security@vibesafe.app
              </a>
            </div>

            <div style={{
              backgroundColor: '#fef3c7',
              border: '2px solid #f59e0b',
              borderRadius: 12,
              padding: 24,
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
                ⚠️ Abuse and Violations
              </h2>
              <p style={{ fontSize: 14, color: '#78350f', marginBottom: 12 }}>
                Report unauthorized scanning, Terms of Service violations, or malicious use of the platform
              </p>
              <a
                href="mailto:abuse@vibesafe.app"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#b45309',
                  textDecoration: 'none',
                }}
              >
                abuse@vibesafe.app
              </a>
            </div>

            <div style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                📄 DMCA Takedown Requests
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Copyright infringement claims under the Digital Millennium Copyright Act
              </p>
              <a
                href="mailto:dmca@vibesafe.app"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  textDecoration: 'none',
                }}
              >
                dmca@vibesafe.app
              </a>
            </div>
          </div>

          <div style={{
            marginTop: 48,
            padding: 24,
            backgroundColor: 'rgba(99, 102, 241, 0.05)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: 12,
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
              Response Times
            </h3>
            <ul style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 24 }}>
              <li><strong>Security vulnerabilities</strong>: Within 24 hours</li>
              <li><strong>Abuse reports</strong>: Within 24-48 hours</li>
              <li><strong>Privacy requests</strong>: Within 30 days (as required by GDPR/CCPA)</li>
              <li><strong>General inquiries</strong>: Within 3-5 business days</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
