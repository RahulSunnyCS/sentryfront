'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconShield, IconExternalLink } from './icons';
import { PdfExportButton } from './pdf-export-button';
import { AuthButton } from './auth-button';
import { ThemeToggle } from './theme-toggle';

interface Props {
  showReportActions?: boolean;
  scanUrl?: string;
  scanId?: string;
}

const NAV_LINKS = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/#features', label: 'Features' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/report/demo', label: 'Demo' },
];

export function Nav({ showReportActions = false, scanUrl, scanId }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the menu when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while menu is open
  useEffect(() => {
    if (open) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = orig; };
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <nav
      aria-label="Primary"
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
        background: 'rgba(10,10,11,0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <Link
        href="/"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
        aria-label="VibeSafe — home"
      >
        <IconShield size={20} color="var(--accent)" />
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>VibeSafe</span>
      </Link>

      {/* Desktop links */}
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
        {NAV_LINKS.map((l) => (
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
            {scanId && <PdfExportButton scanId={scanId} />}
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
              New scan
            </Link>
            {scanUrl && (
              <button
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
                Share
              </button>
            )}
          </>
        )}
        <span className="nav-action-hide-mobile">
          <ThemeToggle />
        </span>
        <span className="nav-action-hide-mobile">
          <AuthButton />
        </span>

        {/* Hamburger — mobile only */}
        <button
          className="nav-hamburger"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true" style={{ transform: open ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
          <span aria-hidden="true" style={{ opacity: open ? 0 : 1 }} />
          <span aria-hidden="true" style={{ transform: open ? 'rotate(-45deg) translate(6px, -6px)' : 'none' }} />
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        className="nav-mobile-menu"
        data-open={open ? 'true' : 'false'}
      >
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
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
        <div
          style={{
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-6)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
          }}
        >
          <AuthButton />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
