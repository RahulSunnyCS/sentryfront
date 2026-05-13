'use client';

import Link from 'next/link';
import { IconShield, IconExternalLink } from './icons';
import { PdfExportButton } from './pdf-export-button';
import { AuthButton } from './auth-button';
import { ThemeToggle } from './theme-toggle';

interface Props {
  showReportActions?: boolean;
  scanUrl?: string;
  scanId?: string;
}

export function Nav({ showReportActions = false, scanUrl, scanId }: Props) {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center',
      padding: '0 24px', height: 56,
      backgroundColor: 'rgba(10, 10, 11, 0.8)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
        <IconShield size={20} color="var(--accent)" />
        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>
          VibeSafe
        </span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginLeft: 40 }}>
        <Link href="/pricing" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}
          onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          Pricing
        </Link>
        <Link href="/report/demo" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}
          onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          Demo
        </Link>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {showReportActions && (
          <>
            {scanId && <PdfExportButton scanId={scanId} />}
            <Link href="/" style={{
              padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)', textDecoration: 'none',
              fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
            }}>
              New scan
            </Link>
            {scanUrl && (
              <button
                onClick={() => navigator.clipboard.writeText(window.location.href).catch(() => {})}
                style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none',
                  backgroundColor: 'var(--accent)', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, color: '#fff',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <IconExternalLink size={13} color="#fff" />
                Share
              </button>
            )}
          </>
        )}
        <ThemeToggle />
        <AuthButton />
      </div>
    </nav>
  );
}
