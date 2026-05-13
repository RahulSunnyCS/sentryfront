import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-light)',
        backgroundColor: 'var(--surface)',
        padding: '48px 24px 32px',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 40,
            marginBottom: 40,
          }}
        >
          {/* About */}
          <div>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 16,
              }}
            >
              VibeSafe
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              Security scanner for AI-built sites. Get a full security report in under 90 seconds.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 16,
              }}
            >
              Product
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link
                href="/"
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                }}
              >
                Home
              </Link>
              <Link
                href="/pricing"
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                }}
              >
                Pricing
              </Link>
              <Link
                href="/report/demo"
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                }}
              >
                Demo Report
              </Link>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 16,
              }}
            >
              Legal
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link
                href="/legal/terms"
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                }}
              >
                Terms of Service
              </Link>
              <Link
                href="/legal/privacy"
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                }}
              >
                Privacy Policy
              </Link>
              <Link
                href="/legal/contact"
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                }}
              >
                Contact
              </Link>
            </div>
          </div>

          {/* Support */}
          <div>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 16,
              }}
            >
              Support
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a
                href="mailto:security@vibesafe.app"
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                }}
              >
                Security
              </a>
              <a
                href="mailto:abuse@vibesafe.app"
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                }}
              >
                Report Abuse
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            paddingTop: 24,
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            © {currentYear} VibeSafe. All rights reserved.
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            Made with ❤️ for the AI coding community
          </p>
        </div>
      </div>
    </footer>
  );
}
