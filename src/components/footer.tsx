import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      style={{
        borderTop: '1px solid var(--border-light)',
        background: 'var(--surface)',
        padding: 'var(--space-12) 0 var(--space-8)',
        marginTop: 'auto',
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-10)',
            marginBottom: 'var(--space-10)',
          }}
        >
          <div>
            <h3
              style={{
                fontSize: 'var(--fs-sm)',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 'var(--space-4)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              VibeSafe
            </h3>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              Security, performance &amp; compliance scanner for AI-built sites. Full report in under 90 seconds.
            </p>
          </div>

          <FooterCol title="Product">
            <FooterLink href="/">Home</FooterLink>
            <FooterLink href="/pricing">Pricing</FooterLink>
            <FooterLink href="/#features">Features</FooterLink>
            <FooterLink href="/#faq">FAQ</FooterLink>
            <FooterLink href="/report/demo">Demo report</FooterLink>
            <FooterLink href="/docs">Docs</FooterLink>
          </FooterCol>

          <FooterCol title="Legal">
            <FooterLink href="/legal/terms">Terms of service</FooterLink>
            <FooterLink href="/legal/privacy">Privacy policy</FooterLink>
            <FooterLink href="/legal/contact">Contact</FooterLink>
          </FooterCol>

          <FooterCol title="Support">
            <FooterLink href="mailto:security@vibesafe.app">Security</FooterLink>
            <FooterLink href="mailto:abuse@vibesafe.app">Report abuse</FooterLink>
            <FooterLink href="mailto:support@vibesafe.app">Support</FooterLink>
          </FooterCol>
        </div>

        <div
          style={{
            paddingTop: 'var(--space-6)',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-4)',
          }}
        >
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
            © {currentYear} VibeSafe. All rights reserved.
          </p>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
            Made for the AI coding community.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        style={{
          fontSize: 'var(--fs-sm)',
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 'var(--space-4)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {title}
      </h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.isArray(children) ? children.map((c, i) => <li key={i}>{c}</li>) : <li>{children}</li>}
      </ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="nav-link"
      style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}
    >
      {children}
    </Link>
  );
}
