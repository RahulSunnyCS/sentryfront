'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function Footer() {
  const t = useTranslations('footer');
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
              {t('tagline')}
            </p>
          </div>

          <FooterCol title={t('product')}>
            <FooterLink href="/">{t('home')}</FooterLink>
            <FooterLink href="/pricing">{t('pricing')}</FooterLink>
            <FooterLink href="/#features">{t('features')}</FooterLink>
            <FooterLink href="/#faq">{t('faq')}</FooterLink>
            <FooterLink href="/docs">{t('docs')}</FooterLink>
          </FooterCol>

          <FooterCol title={t('legal')}>
            <FooterLink href="/legal/terms">{t('terms')}</FooterLink>
            <FooterLink href="/legal/privacy">{t('privacy')}</FooterLink>
            <FooterLink href="/legal/contact">{t('contact')}</FooterLink>
          </FooterCol>

          <FooterCol title={t('support')}>
            <FooterExternal href="mailto:security@vibesafe.app">{t('security')}</FooterExternal>
            <FooterExternal href="mailto:abuse@vibesafe.app">{t('abuse')}</FooterExternal>
            <FooterExternal href="mailto:support@vibesafe.app">{t('supportEmail')}</FooterExternal>
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
            {t('copyright', { year: currentYear })}
          </p>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
            {t('community')}
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

function FooterExternal({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="nav-link"
      style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}
    >
      {children}
    </a>
  );
}
