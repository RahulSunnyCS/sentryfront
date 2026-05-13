'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { IconShield, IconGlobe, IconArrowRight } from '@/components/icons';
import { createScan } from '@/lib/api';

const TRUST_ITEMS = [
  'No login required',
  'Stripe-secured',
  '30-day refund guarantee',
  'No security expertise needed',
];

const HERO_FINDINGS = [
  { status: 'Protected', title: 'Stripe account secured', sub: 'Secret key removed from JS bundle' },
  { status: 'Protected', title: 'Security headers hardened', sub: 'Enterprise-grade protection enabled' },
  { status: 'Confirmed', title: 'GDPR compliance verified', sub: "Your users' data is protected" },
];

const CATEGORIES = [
  { label: '🛡️ Security', color: null },
  { label: '⚖️ Compliance', color: null },
  { label: '⚡ Performance', color: null },
  { label: '♿ Accessibility', color: null },
  { label: '🔍 SEO', color: null },
  { label: '🔴 Active Testing', color: '#DC2626', bg: 'rgba(220,38,38,0.06)' },
  { label: '📋 Code Scanning', color: '#7C3AED', bg: 'rgba(124,58,237,0.06)' },
];

const FEATURE_CARDS = [
  {
    emoji: '🛡️',
    title: 'Security Scanning',
    desc: '15 security modules detect exposed secrets (700+ patterns), missing headers, XSS, CORS issues, and vulnerable dependencies',
    tags: '✓ Gitleaks integration • ✓ Subdomain takeover • ✓ SSL/TLS checks',
  },
  {
    emoji: '💻',
    title: 'Code Scanning (CI/CD)',
    desc: 'Catch secrets before deployment with GitHub Actions, GitLab CI, or Bitbucket Pipelines integration',
    tags: '✓ GitHub • ✓ GitLab • ✓ Bitbucket • ✓ PR comments',
  },
  {
    emoji: '⚖️',
    title: 'Compliance Checks',
    desc: 'GDPR, WCAG 2.2 Level AA, cookie consent, privacy policy detection — stay legally compliant',
    tags: '✓ GDPR • ✓ WCAG 2.2 AA • ✓ Cookie consent',
  },
  {
    emoji: '⚡',
    title: 'Performance Audits',
    desc: 'Core Web Vitals, Lighthouse scores, image optimization, render-blocking resources and more',
    tags: '✓ LCP, FCP, CLS • ✓ Lighthouse • ✓ Mobile perf',
  },
  {
    emoji: '♿',
    title: 'Accessibility',
    desc: 'WCAG 2.2 checks, color contrast, keyboard navigation, screen-reader compatibility',
    tags: '✓ Color contrast • ✓ Keyboard nav • ✓ ARIA labels',
  },
  {
    emoji: '🤖',
    title: 'AI Fix Prompts',
    desc: 'Every finding includes a ready-to-paste fix prompt for Cursor, v0, Bolt, or Lovable',
    tags: '✓ Cursor • ✓ v0 • ✓ Bolt • ✓ Lovable',
  },
];

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
    <div style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Hero ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '80px 24px 40px', textAlign: 'center',
      }}>

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px',
          borderRadius: 20, backgroundColor: 'var(--accent-light)', marginBottom: 32,
          fontSize: 13, fontWeight: 600, color: 'var(--accent)',
        }}>
          <IconShield size={16} color="var(--accent)" />
          Enterprise-grade security &bull; Starting at $9
        </div>

        <h1 style={{
          fontSize: 'clamp(32px,5vw,56px)', fontWeight: 800, lineHeight: 1.1,
          color: 'var(--text)', maxWidth: 680, marginBottom: 16, letterSpacing: '-0.02em',
        }}>
          Your AI-built site is now<br />technically solid
        </h1>

        <p style={{
          fontSize: 'clamp(16px,2vw,19px)', color: 'var(--text-secondary)', maxWidth: 540,
          lineHeight: 1.6, marginBottom: 40,
        }}>
          Paste a URL. Know in 90 seconds if your site is enterprise-ready. Every finding comes with the exact AI prompt to fix it in Cursor, v0, or Lovable.
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
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Starting…' : 'Scan Free'}
            {!loading && <IconArrowRight size={16} color="#fff" />}
          </button>
        </div>

        {error && (
          <p style={{ marginTop: 12, fontSize: 13, color: '#E11D48', maxWidth: 560 }}>{error}</p>
        )}

        {/* Live counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, fontSize: 13, color: 'var(--text-tertiary)' }}>
          <div className="pulse-dot" style={{
            width: 6, height: 6, borderRadius: '50%', background: '#059669', flexShrink: 0,
          }} />
          <span>
            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>4,247</span>
            {' '}sites scanned this week &bull;{' '}
            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>2,847</span>
            {' '}developers upgraded
          </span>
        </div>

        {/* Trust row */}
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: 20, flexWrap: 'wrap', marginTop: 40,
        }}>
          {TRUST_ITEMS.map((item, i) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && (
                <div style={{ width: 1, height: 14, background: 'var(--border)', marginRight: 14 }} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {item}
              </div>
            </div>
          ))}
        </div>

        {/* Hero finding cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12, maxWidth: 680, width: '100%', margin: '40px auto 0',
        }}>
          {HERO_FINDINGS.map((f) => (
            <div key={f.title} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '14px 16px', textAlign: 'left',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, fontWeight: 700, color: '#059669',
                textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                {f.status}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.4 }}>{f.sub}</div>
            </div>
          ))}
        </div>

        {/* Category pills */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap',
          maxWidth: 600, margin: '40px auto 0',
        }}>
          {CATEGORIES.map((cat) => (
            <div key={cat.label} style={{
              padding: '7px 14px',
              background: cat.bg ?? 'var(--surface)',
              border: `1px solid ${cat.color ?? 'var(--border)'}`,
              borderRadius: 20,
              fontSize: 13, fontWeight: 600,
              color: cat.color ?? 'var(--text-secondary)',
            }}>
              {cat.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Features Section ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 80px', width: '100%' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, marginBottom: 16 }}>
          Everything you need to ship with confidence
        </h2>
        <p style={{ textAlign: 'center', fontSize: 18, color: 'var(--text-secondary)', marginBottom: 64, maxWidth: 700, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
          From security to SEO, we check it all — so you don&apos;t have to
        </p>

        {/* Active Testing highlight */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(220,38,38,0.08) 0%, rgba(124,58,237,0.08) 100%)',
          border: '1px solid rgba(220,38,38,0.3)', borderRadius: 16, padding: '32px 40px',
          marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 32, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 28 }}>🔴</span>
              <span style={{ background: '#DC2626', color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>New</span>
              <span style={{ fontSize: 13, color: '#DC2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Security Testing</span>
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, lineHeight: 1.3 }}>We try to break your site — so attackers can&apos;t</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 520 }}>
              Beyond passive checks: VibeSafe actually sends attack probes — SQL injection, XSS payloads, API fuzzing — against your verified domain. You get <strong style={{ color: 'var(--text)' }}>CONFIRMED exploitable</strong> findings, not guesses.
            </p>
            <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
              {['SQL injection probing', 'XSS payload testing', 'API endpoint fuzzing', 'Auth bypass attempts'].map((t) => (
                <div key={t} style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>✓ {t}</div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', minWidth: 200 }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Replaces</div>
              <div style={{ fontSize: 24, fontWeight: 800, textDecoration: 'line-through', color: 'var(--text-secondary)', marginBottom: 2 }}>$5,000</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>manual pentest engagement</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>VibeSafe</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#DC2626', marginBottom: 2 }}>3 credits</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>per active scan (~$3.48)</div>
            </div>
          </div>
        </div>

        {/* Code Scanning highlight */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(13,148,136,0.08) 100%)',
          border: '1px solid rgba(124,58,237,0.3)', borderRadius: 16, padding: '32px 40px',
          marginBottom: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 32, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 28 }}>📋</span>
              <span style={{ fontSize: 13, color: '#7C3AED', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>GitHub Code Scanning</span>
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, lineHeight: 1.3 }}>Catch secrets before they ship — in your repo</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 520 }}>
              Connect your GitHub repo and VibeSafe scans every PR for hardcoded API keys, secrets, and security anti-patterns — before they ever reach production.
            </p>
            <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
              {['Gitleaks integration', 'PR comments', 'Block merge on critical', '1 credit per scan'].map((t) => (
                <div key={t} style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>✓ {t}</div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', minWidth: 200, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <div style={{ color: '#7C3AED', fontWeight: 700, marginBottom: 8 }}>⚠ PR #47 blocked</div>
              <div style={{ color: '#DC2626' }}>✗ OPENAI_API_KEY exposed</div>
              <div style={{ color: '#DC2626' }}>✗ DB password in config.js</div>
              <div style={{ color: '#059669', marginTop: 4 }}>✓ Fix + merge to proceed</div>
            </div>
          </div>
        </div>

        {/* Feature grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
          {FEATURE_CARDS.map((card) => (
            <FeatureCard key={card.title} {...card} />
          ))}
        </div>
      </div>

      {/* ── Tools strip ── */}
      <div style={{
        textAlign: 'center', padding: '32px 24px 56px',
        borderTop: '1px solid var(--border-light)',
      }}>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16, fontWeight: 500 }}>
          Built for sites made with
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
          {['Lovable', 'Bolt', 'v0', 'Cursor', 'Replit'].map((t) => (
            <span key={t} style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', opacity: 0.6 }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ emoji, title, desc, tags }: { emoji: string; title: string; desc: string; tags: string }) {
  return (
    <div
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: 32, transition: 'all 0.2s', cursor: 'default',
      }}
      onMouseOver={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 16 }}>{emoji}</div>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{title}</h3>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>{desc}</p>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{tags}</div>
    </div>
  );
}
