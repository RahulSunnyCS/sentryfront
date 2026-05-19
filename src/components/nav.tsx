'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { IconExternalLink } from './icons';
import { Logo } from './logo';
import { PdfExportButton } from './pdf-export-button';
import { AuthButton } from './auth-button';
import { VerifyEmailNudge } from './verify-email-nudge';
import { LocaleSwitcher } from './locale-switcher';
import { ThemeToggle } from './theme-toggle';
import { useFeature } from '@/lib/client-features';

interface CreditsData {
  tier: string;
  activeTestCredits: number;
  weeklyScansRemaining: number | null;
  weeklyLimit: number | null;
}

function CreditsChip() {
  const authEnabled = useFeature('auth');
  const { status } = useSession();
  const [credits, setCredits] = useState<CreditsData | null>(null);

  useEffect(() => {
    if (!authEnabled || status !== 'authenticated') return;
    fetch('/api/v1/me/credits')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCredits(data))
      .catch(() => {});
  }, [authEnabled, status]);

  if (!authEnabled || status !== 'authenticated' || !credits) return null;

  // Free tier: show weekly passive scan quota
  if (credits.tier === 'free' && credits.weeklyScansRemaining !== null && credits.weeklyLimit !== null) {
    const remaining = credits.weeklyScansRemaining;
    const empty = remaining === 0;
    return (
      <div
        className="nav-action-hide-mobile"
        title={`${remaining} of ${credits.weeklyLimit} free scan${credits.weeklyLimit !== 1 ? 's' : ''} remaining this week`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          borderRadius: 20,
          background: empty ? 'rgba(220,38,38,0.08)' : 'color-mix(in srgb, var(--accent) 10%, transparent)',
          border: `1px solid ${empty ? 'rgba(220,38,38,0.25)' : 'color-mix(in srgb, var(--accent) 30%, transparent)'}`,
          fontSize: 12,
          fontWeight: 600,
          color: empty ? '#DC2626' : 'var(--accent)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700 }}>{remaining}</span>
        <span style={{ opacity: 0.75 }}>/ {credits.weeklyLimit} free scan{credits.weeklyLimit !== 1 ? 's' : ''}</span>
      </div>
    );
  }

  // Paid tiers with active test credits (one-shot, pro)
  if (credits.tier !== 'free' && credits.tier !== 'studio') {
    const n = credits.activeTestCredits;
    const empty = n === 0;
    return (
      <div
        className="nav-action-hide-mobile"
        title={`${n} active test credit${n !== 1 ? 's' : ''} remaining`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          borderRadius: 20,
          background: empty ? 'rgba(220,38,38,0.08)' : 'color-mix(in srgb, var(--accent) 10%, transparent)',
          border: `1px solid ${empty ? 'rgba(220,38,38,0.25)' : 'color-mix(in srgb, var(--accent) 30%, transparent)'}`,
          fontSize: 12,
          fontWeight: 600,
          color: empty ? '#DC2626' : 'var(--accent)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700 }}>{n}</span>
        <span style={{ opacity: 0.75 }}>credit{n !== 1 ? 's' : ''}</span>
      </div>
    );
  }

  return null;
}

// LocaleSwitcher + ThemeToggle live in the signed-out navbar only. When the
// user IS signed in they move into the AuthButton user menu (auth-button.tsx),
// so they must NOT also appear here. We mirror AuthButton's own auth signal
// exactly (useFeature('auth') + useSession status) so the navbar shows them in
// precisely the states AuthButton shows the "Sign in" link rather than the
// user menu: auth feature disabled, or no authenticated session (this also
// covers the brief 'loading' state and the E2E unauthenticated /en case).
function NavPreferences() {
  const authEnabled = useFeature('auth');
  const { status } = useSession();

  // Signed in only when the auth feature is enabled AND a session exists.
  const signedIn = authEnabled && status === 'authenticated';
  if (signedIn) return null;

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
    >
      <LocaleSwitcher />
      <ThemeToggle />
    </span>
  );
}

interface Props {
  showReportActions?: boolean;
  scanUrl?: string;
  scanId?: string;
}

export function Nav({ showReportActions = false, scanUrl, scanId }: Props) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navLinks = [
    { href: '/pricing', label: t('pricing') },
    { href: '/#features', label: t('features') },
    { href: '/#faq', label: t('faq') },
  ];

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = orig; };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <nav
      aria-label={t('primary')}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        height: 'var(--nav-h)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-6)',
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <Link
        href="/"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
        aria-label={t('homeAria')}
      >
        <Logo size={22} />
      </Link>

      <ul
        className="nav-desktop"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-6)',
          marginLeft: 'var(--space-10)',
          listStyle: 'none',
          margin: '0 0 0 var(--space-10)',
          padding: 0,
        }}
      >
        {navLinks.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="nav-link"
              style={{
                fontSize: 'var(--fs-sm)',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                transition: 'color 0.15s ease',
              }}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>

      <div style={{ flex: 1 }} />

      <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {showReportActions && (
          <>
            {scanId && (
              <span className="nav-action-hide-mobile">
                <PdfExportButton scanId={scanId} />
              </span>
            )}
            <Link
              href="/"
              className="nav-action-hide-mobile"
              style={{
                padding: '7px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                fontSize: 'var(--fs-sm)',
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}
            >
              {tCommon('newScan')}
            </Link>
            {scanUrl && (
              <button
                className="nav-action-hide-mobile"
                onClick={() => navigator.clipboard.writeText(window.location.href).catch(() => {})}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'var(--accent)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 600,
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <IconExternalLink size={13} color="#fff" />
                {tCommon('share')}
              </button>
            )}
          </>
        )}
        <CreditsChip />
        <VerifyEmailNudge />
        {/* Desktop bar only (hidden on mobile via CSS). Signed-out shows the
            switchers here; signed-in they live in the AuthButton user menu.
            On mobile they move into the slide-out menu instead (below) so the
            cramped top bar stays clean. */}
        <span className="nav-action-hide-mobile">
          <NavPreferences />
        </span>
        <span className="nav-action-hide-mobile">
          <AuthButton />
        </span>

        <button
          className="nav-hamburger"
          aria-label={open ? t('closeMenu') : t('openMenu')}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true" style={{ transform: open ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
          <span aria-hidden="true" style={{ opacity: open ? 0 : 1 }} />
          <span aria-hidden="true" style={{ transform: open ? 'rotate(-45deg) translate(6px, -6px)' : 'none' }} />
        </button>
      </div>

      {/* Mobile menu is portaled to <body> so it escapes this <nav>'s
          stacking context: nav has position:fixed + z-index:100 +
          backdrop-filter (each creates a stacking context), which previously
          trapped the menu's z-index no matter how high it was set. On body it
          sits above all page content as intended. */}
      {mounted &&
        createPortal(
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label={t('siteMenu')}
            className="nav-mobile-menu"
            data-open={open ? 'true' : 'false'}
          >
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {navLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    style={{
                      display: 'block',
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--fs-lg)',
                      fontWeight: 600,
                      color: 'var(--text)',
                    }}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Report actions, surfaced as prominent full-width items so they
                stay discoverable in the menu (the bar versions are hidden on
                mobile to declutter — moving them here keeps the user aware
                and one tap away rather than removing them). */}
            {showReportActions && (
              <div
                style={{
                  marginTop: 'var(--space-6)',
                  paddingTop: 'var(--space-6)',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                }}
              >
                {scanId && <PdfExportButton scanId={scanId} />}
                {scanUrl && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href).catch(() => {});
                      setOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: 'var(--accent)',
                      fontSize: 'var(--fs-lg)',
                      fontWeight: 600,
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <IconExternalLink size={15} color="#fff" />
                    {tCommon('share')}
                  </button>
                )}
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    fontSize: 'var(--fs-lg)',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {tCommon('newScan')}
                </Link>
              </div>
            )}

            <div
              style={{
                marginTop: 'var(--space-6)',
                paddingTop: 'var(--space-6)',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-4)',
              }}
            >
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                <VerifyEmailNudge />
                <AuthButton />
              </div>
              {/* Signed-out mobile users get locale/theme here (inside the
                  menu). Signed-in users get them via the AuthButton user menu
                  above, so NavPreferences renders null for them. */}
              <NavPreferences />
            </div>
          </div>,
          document.body,
        )}
    </nav>
  );
}
