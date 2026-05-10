'use client';

import Link from 'next/link';
import { IconShield, IconExternalLink } from './icons';

interface Props {
  showReportActions?: boolean;
  scanUrl?: string;
}

export function Nav({ showReportActions = false, scanUrl }: Props) {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', height: 56,
      backgroundColor: 'rgba(250,250,248,0.85)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-light)',
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
        <IconShield size={24} color="var(--accent)" />
        <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>
          VibeSafe
        </span>
      </Link>

      {showReportActions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
        </div>
      )}
    </nav>
  );
}
