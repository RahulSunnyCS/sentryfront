import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { Logo } from '@/components/logo';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { ResendButton } from './resend-button';
import { routing, type Locale } from '@/i18n/routing';

export const metadata: Metadata = {
  title: 'Verify your email',
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return routing.locales.map((locale: Locale) => ({ locale }));
}

export default async function VerifyEmailSentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ email?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: locale as Locale });
  }

  // If already verified, skip straight to the dashboard
  const dbUser = await prisma.user.findUnique({
    where: { id: user!.id },
    select: { emailVerified: true, email: true },
  });
  if (dbUser?.emailVerified) {
    redirect({ href: '/dashboard', locale: locale as Locale });
  }

  const sp = await searchParams;
  const displayEmail = sp?.email ?? dbUser?.email ?? '';

  return (
    <>
      <Nav />
      <div style={{ paddingTop: 'var(--nav-h)', display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-10) var(--space-4)' }}>
          <article
            style={{
              width: '100%',
              maxWidth: 440,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'clamp(24px, 5vw, 40px)',
              boxShadow: 'var(--shadow-md)',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-6)' }}>
              <Logo size={28} />
            </div>

            {/* Envelope illustration */}
            <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 'var(--space-4)' }} aria-hidden="true">
              ✉️
            </div>

            <h1 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>
              Check your inbox
            </h1>

            <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
              We sent a verification link to{' '}
              {displayEmail ? (
                <strong style={{ color: 'var(--text)' }}>{displayEmail}</strong>
              ) : (
                'your email address'
              )}
              . Click it to activate your account.
            </p>

            <div
              style={{
                background: 'var(--surface-raised, color-mix(in srgb, var(--border) 50%, transparent))',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginBottom: 'var(--space-6)',
                fontSize: 'var(--fs-sm)',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                textAlign: 'left',
              }}
            >
              <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>Didn&apos;t get it?</strong>
              Check your spam folder. The link expires in 24 hours.
            </div>

            <ResendButton />

            <div style={{ marginTop: 'var(--space-5)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-5)' }}>
              <a
                href="/"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}
              >
                <span aria-hidden="true">←</span>
                Continue browsing in the meantime
              </a>
            </div>

            <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
              Wrong account?{' '}
              <a href="/api/auth/signout" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                Sign out
              </a>
            </p>
          </article>
        </main>
        <Footer />
      </div>
    </>
  );
}
