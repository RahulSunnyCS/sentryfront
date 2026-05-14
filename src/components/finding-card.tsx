'use client';

import Link from 'next/link';
import { SEVERITY_CONFIG } from '@/lib/data';
import type { Finding, CardStyle, Severity } from '@/types';
import { SeverityBadge } from './severity-badge';
import { CopyButton } from './copy-button';
import { IconChevronDown, IconAlertCircle, IconShield } from './icons';

const SEVERITY_ICON: Record<Severity, (color: string) => React.ReactNode> = {
  CRITICAL: (c) => <IconAlertCircle size={20} color={c} />,
  HIGH: (c) => <IconAlertCircle size={20} color={c} />,
  MEDIUM: (c) => <IconAlertCircle size={20} color={c} />,
  LOW: (c) => <IconShield size={20} color={c} />,
  INFO: (c) => <IconShield size={20} color={c} />,
};

interface Props {
  finding: Finding;
  isExpanded: boolean;
  onToggle: () => void;
  cardStyle: CardStyle;
  /** When true, the AI Fix Prompt is hidden behind a Pro Lock overlay. */
  isAiPromptLocked?: boolean;
}

const sectionTitle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
};

const bodyText: React.CSSProperties = {
  fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0,
};

export function FindingCard({ finding, isExpanded, onToggle, cardStyle, isAiPromptLocked = false }: Props) {
  const sevConfig = SEVERITY_CONFIG[finding.severity];

  const border = cardStyle === 'bordered'
    ? `1px solid ${sevConfig.border}`
    : '1px solid var(--border)';
  const shadow = cardStyle === 'elevated' ? 'var(--shadow-md)' : 'none';
  const bg = cardStyle === 'flat' ? 'var(--bg)' : 'var(--surface)';

  return (
    <div style={{ borderRadius: 12, border, backgroundColor: bg, boxShadow: shadow, overflow: 'hidden', transition: 'all 0.2s' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 36, height: 36, flexShrink: 0,
            borderRadius: 10,
            backgroundColor: sevConfig.bg,
            border: `1px solid ${sevConfig.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {SEVERITY_ICON[finding.severity](sevConfig.color)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{finding.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--mono)' }}>{finding.location}</div>
        </div>
        <SeverityBadge severity={finding.severity} />
        <IconChevronDown
          size={18}
          color="var(--text-tertiary)"
          style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', flexShrink: 0 }}
        />
      </button>

      {isExpanded && (
        <div style={{ padding: '0 16px 20px', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ marginTop: 16 }}>
            <div style={sectionTitle}>Evidence</div>
            <pre style={{
              backgroundColor: '#1a1a2e', color: '#e2e8f0', padding: '14px 16px',
              borderRadius: 8, fontSize: 12.5, lineHeight: 1.6, overflowX: 'auto',
              fontFamily: 'var(--mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              margin: 0,
            }}>{finding.evidence}</pre>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={sectionTitle}>Explanation</div>
            <p style={bodyText}>{finding.explanation}</p>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={sectionTitle}>Impact</div>
            <p style={bodyText}>{finding.impact}</p>
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={sectionTitle}>Manual fix</div>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {finding.fixManual.map((step, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      width: 24, height: 24, borderRadius: 999,
                      background: 'var(--accent)', color: '#fff',
                      fontSize: 12, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* AI Fix Prompt — locked behind a Pro Lock overlay for free / unauthenticated users. */}
          <div style={{ marginTop: 20 }}>
            {isAiPromptLocked ? (
              <Link
                href="/pricing#one-shot"
                aria-label="Unlock AI fix prompt"
                style={{
                  display: 'block',
                  borderRadius: 10,
                  border: '1px dashed rgba(13,148,136,0.4)',
                  background: 'linear-gradient(135deg, rgba(13,148,136,0.08), rgba(124,58,237,0.06))',
                  padding: 20,
                  textAlign: 'center',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div aria-hidden="true" style={{ fontSize: 20, marginBottom: 6 }}>🔒</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
                  Pro: Get the exact Cursor / Lovable prompt
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  AI codes the fix in minutes — paste, review, deploy.
                </div>
                <span style={{
                  display: 'inline-block',
                  padding: '7px 16px',
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  Unlock AI Fix Prompt →
                </span>
              </Link>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                  <div style={sectionTitle}>🤖 AI fix prompt</div>
                  <CopyButton text={finding.fixAiPrompt} label="Copy prompt" />
                </div>
                <pre style={{
                  backgroundColor: 'var(--accent-light)',
                  border: '1px solid var(--accent)',
                  borderRadius: 8, padding: '14px 16px',
                  fontSize: 13, lineHeight: 1.6,
                  color: 'var(--text)', opacity: 0.95,
                  fontFamily: 'var(--mono)', whiteSpace: 'pre-wrap',
                  margin: 0,
                  overflowX: 'auto',
                }}>{finding.fixAiPrompt}</pre>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
                  Paste into Cursor, Lovable, v0, or Bolt.
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
