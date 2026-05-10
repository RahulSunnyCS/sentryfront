'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { IconShield, IconGlobe, IconArrowRight } from '@/components/icons';
import { createScan } from '@/lib/api';

const FEATURES = [
  { title: '15 security checks', desc: 'Secrets, headers, CORS, TLS, cookies, exposed paths, and more.' },
  { title: 'Under 90 seconds', desc: 'Full passive scan without touching your codebase or server.' },
  { title: 'AI fix prompts', desc: 'Every finding includes a prompt you can paste into Cursor or Lovable.' },
];

const TOOLS = ['Lovable', 'Bolt', 'v0', 'Cursor', 'Replit'];

export function LandingHero() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleScan = async () => {
    const target = url.trim() || 'taskflow.app';
    setError(null);
    setLoading(true);
    try {
      const { id } = await createScan(target);
      router.push(`/scan/${id}?url=${encodeURIComponent(target)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start scan. Please try again.');
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleScan();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '80px 24px 40px', textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px',
          borderRadius: 20, backgroundColor: 'var(--accent-light)', marginBottom: 32,
          fontSize: 13, fontWeight: 600, color: 'var(--accent)',
        }}>
          <IconShield size={16} color="var(--accent)" />
          Passive scan — no config required
        </div>

        <h1 style={{
          fontSize: 'clamp(32px,5vw,56px)', fontWeight: 800, lineHeight: 1.1,
          color: 'var(--text)', maxWidth: 680, marginBottom: 16, letterSpacing: '-0.02em',
        }}>
          Is your AI-built site actually secure?
        </h1>

        <p style={{
          fontSize: 'clamp(16px,2vw,19px)', color: 'var(--text-secondary)', maxWidth: 540,
          lineHeight: 1.6, marginBottom: 40,
        }}>
          Paste a URL. Get a security report in 90 seconds. Every finding comes with a fix you can paste right into your AI coding tool.
        </p>

        {/* URL input */}
        <div style={{
          display: 'flex', width: '100%', maxWidth: 560, borderRadius: 14,
          border: '2px solid var(--border)', backgroundColor: 'var(--surface)',
          overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
        }}>
          <div style={{ padding: '0 0 0 18px', display: 'flex', alignItems: 'center', color: 'var(--text-tertiary)' }}>
            <IconGlobe size={20} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="taskflow.app"
            disabled={loading}
            style={{
              flex: 1, padding: '16px 12px', border: 'none', outline: 'none',
              fontSize: 16, color: 'var(--text)', backgroundColor: 'transparent',
              fontFamily: 'var(--font)',
            }}
          />
          <button
            onClick={handleScan}
            disabled={loading}
            style={{
              padding: '12px 28px', margin: 6, borderRadius: 10, border: 'none',
              backgroundColor: loading ? 'var(--text-tertiary)' : 'var(--accent)',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
              transition: 'background-color 0.2s',
            }}
          >
            {loading ? 'Starting…' : 'Scan'}
            {!loading && <IconArrowRight size={16} color="#fff" />}
          </button>
        </div>

        {error && (
          <p style={{ marginTop: 12, fontSize: 13, color: '#E11D48', maxWidth: 560 }}>{error}</p>
        )}

        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 16 }}>
          No CLI. No config files. No security knowledge needed.
        </p>
      </div>

      {/* Feature cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))',
        gap: 20, maxWidth: 780, width: '100%', margin: '0 auto', padding: '0 24px 48px',
      }}>
        {FEATURES.map((f, i) => (
          <div key={i} style={{
            padding: 24, borderRadius: 12, border: '1px solid var(--border)',
            backgroundColor: 'var(--surface)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Tools strip */}
      <div style={{
        textAlign: 'center', padding: '32px 24px 56px',
        borderTop: '1px solid var(--border-light)',
      }}>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16, fontWeight: 500 }}>
          Built for sites made with
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
          {TOOLS.map((t) => (
            <span key={t} style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', opacity: 0.6 }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
