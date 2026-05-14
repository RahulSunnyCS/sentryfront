'use client';

import { useState } from 'react';
import { SEVERITY_CONFIG } from '@/lib/data';
import type { Finding, CardStyle, FindingDispositionValue } from '@/types';
import { SeverityBadge } from './severity-badge';
import { CopyButton } from './copy-button';
import { IconChevronDown } from './icons';
import { useDisposition } from '@/lib/hooks/use-disposition';

interface Props {
  finding: Finding;
  isExpanded: boolean;
  onToggle: () => void;
  cardStyle: CardStyle;
  scanId?: string;
  authed?: boolean;
}

const DISPOSITION_BUTTONS: Array<{ value: FindingDispositionValue; label: string }> = [
  { value: 'helpful', label: 'Helpful' },
  { value: 'dismissed', label: 'Dismiss' },
  { value: 'fp', label: 'False positive' },
  { value: 'fix_didnt_help', label: "Fix didn't help" },
];

const sectionTitle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
};

const bodyText: React.CSSProperties = {
  fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0,
};

export function FindingCard({ finding, isExpanded, onToggle, cardStyle, scanId, authed }: Props) {
  const [fixTab, setFixTab] = useState<'manual' | 'ai'>('manual');
  const sevConfig = SEVERITY_CONFIG[finding.severity];
  const disposition = useDisposition(scanId, finding.id, finding.currentDisposition ?? null);

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
        <SeverityBadge severity={finding.severity} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{finding.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--mono)' }}>{finding.location}</div>
        </div>
        <IconChevronDown
          size={18}
          color="var(--text-tertiary)"
          style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', flexShrink: 0 }}
        />
      </button>

      {isExpanded && (
        <div style={{ padding: '0 16px 20px', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ marginTop: 16 }}>
            <div style={sectionTitle}>What this means</div>
            <p style={bodyText}>{finding.explanation}</p>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={sectionTitle}>Evidence</div>
            <pre style={{
              backgroundColor: '#1a1a2e', color: '#e2e8f0', padding: '14px 16px',
              borderRadius: 8, fontSize: 12.5, lineHeight: 1.6, overflowX: 'auto',
              fontFamily: 'var(--mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>{finding.evidence}</pre>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={sectionTitle}>Impact</div>
            <p style={bodyText}>{finding.impact}</p>
          </div>

          <div style={{ marginTop: 16 }} data-testid="disposition-row">
            <div style={sectionTitle}>Was this useful?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DISPOSITION_BUTTONS.map((btn) => {
                const selected = disposition.current === btn.value;
                return (
                  <button
                    key={btn.value}
                    type="button"
                    disabled={!authed || disposition.isPending}
                    onClick={() => disposition.set(btn.value)}
                    aria-pressed={selected}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: authed ? 'pointer' : 'not-allowed',
                      backgroundColor: selected ? 'var(--accent)' : 'transparent',
                      color: selected ? 'var(--accent-contrast, #fff)' : 'var(--text-secondary)',
                      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                      opacity: !authed ? 0.6 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>
            {!authed && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
                Sign in to flag findings.
              </div>
            )}
            {disposition.error && (
              <div style={{ fontSize: 12, color: 'var(--danger, #c0392b)', marginTop: 6 }}>
                {disposition.error}
              </div>
            )}
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={sectionTitle}>How to fix</div>
              <div style={{ display: 'flex', gap: 2, backgroundColor: 'var(--border-light)', borderRadius: 8, padding: 2 }}>
                {(['manual', 'ai'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFixTab(tab)}
                    style={{
                      padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600,
                      backgroundColor: fixTab === tab ? 'var(--surface)' : 'transparent',
                      color: fixTab === tab ? 'var(--text)' : 'var(--text-tertiary)',
                      boxShadow: fixTab === tab ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {tab === 'manual' ? 'Manual steps' : 'AI prompt'}
                  </button>
                ))}
              </div>
            </div>

            {fixTab === 'manual' ? (
              <ol style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {finding.fixManual.map((step, i) => (
                  <li key={i} style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{step}</li>
                ))}
              </ol>
            ) : (
              <div>
                <div style={{
                  backgroundColor: 'var(--accent-light)', border: '1px solid var(--accent)',
                  borderRadius: 8, padding: '14px 16px', fontSize: 13, lineHeight: 1.6,
                  color: 'var(--text)', marginBottom: 10, opacity: 0.9,
                  fontFamily: 'var(--mono)', whiteSpace: 'pre-wrap',
                }}>
                  {finding.fixAiPrompt}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CopyButton text={finding.fixAiPrompt} label="Copy prompt" />
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    Paste into Cursor, Lovable, or Bolt
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
