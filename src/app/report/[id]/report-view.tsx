'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { GRADE_CONFIG, SCAN_MODULES } from '@/lib/data';
import type { ScanData, Severity, Finding, Grade } from '@/types';
import { GradeDisplay } from '@/components/grade-display';
import { SeveritySummary } from '@/components/severity-summary';
import { FindingCard } from '@/components/finding-card';
import { IconGlobe, IconClock, IconAlertCircle, IconCheck } from '@/components/icons';
import { TierGateBanner } from '@/components/tier-gate-banner';
import { ReportWatermark } from '@/components/report-watermark';
import { PerformanceSection } from '@/components/performance-section';
import { AccessibilitySection } from '@/components/accessibility-section';
import { SEOSection } from '@/components/seo-section';

const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

// Severity score weights — must mirror scan-worker.ts so the improvement
// pill's recomputed grade matches what the backend would actually issue.
const SEVERITY_WEIGHT: Record<Severity, number> = {
  CRITICAL: 25, HIGH: 10, MEDIUM: 3, LOW: 1, INFO: 0,
};

function gradeFromScore(score: number): Grade {
  if (score === 0) return 'A';
  if (score <= 5) return 'B';
  if (score <= 20) return 'C';
  if (score <= 50) return 'D';
  return 'F';
}

// Soft qualitative band per grade — used in place of a fabricated
// "Better than X% of sites" stat. No comparative data exists yet.
const GRADE_BAND: Record<Grade, string> = {
  A: 'Top-tier security posture',
  B: 'Above-average security posture',
  C: 'Average — gaps worth closing',
  D: 'Below average — multiple risks',
  F: 'At risk — fix critical items now',
};

interface FindingsResponse {
  findings: Finding[];
  meta: {
    isLimited: boolean;
    tier: string;
    total: number;
    shown: number;
    limit?: number;
    hiddenCount?: number;
  };
}

type ReportView = 'critical' | 'all' | 'passed';

export function ReportView({ scanData }: { scanData: ScanData }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ReportView>(
    scanData.summary.CRITICAL > 0 ? 'critical' : 'all',
  );
  const [gatedFindings, setGatedFindings] = useState<Finding[]>(scanData.findings);
  const [tierMeta, setTierMeta] = useState<FindingsResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch findings with tier gating applied
  useEffect(() => {
    async function fetchFindings() {
      try {
        const res = await fetch(`/api/v1/scans/${scanData.id}/findings`);
        if (!res.ok) {
          console.error('Failed to fetch findings');
          setGatedFindings(scanData.findings);
          setLoading(false);
          return;
        }
        const data: FindingsResponse = await res.json();
        setGatedFindings(data.findings);
        setTierMeta(data.meta);
      } catch (error) {
        console.error('Error fetching findings:', error);
        setGatedFindings(scanData.findings);
      } finally {
        setLoading(false);
      }
    }
    fetchFindings();
  }, [scanData.id, scanData.findings]);

  const gradeConfig = GRADE_CONFIG[scanData.grade];

  // Honest "fix these → grade improves to X" pill. Recomputes the score
  // using the same weights as scan-worker.ts after removing all CRITICAL
  // and HIGH findings. If the resulting grade isn't actually higher, the
  // pill doesn't render (silent rather than misleading).
  const criticalHighCount = scanData.summary.CRITICAL + scanData.summary.HIGH;
  const currentScore = SEVERITY_ORDER.reduce(
    (sum, sev) => sum + SEVERITY_WEIGHT[sev] * (scanData.summary[sev] ?? 0),
    0,
  );
  const scoreAfterFix =
    currentScore -
    SEVERITY_WEIGHT.CRITICAL * scanData.summary.CRITICAL -
    SEVERITY_WEIGHT.HIGH * scanData.summary.HIGH;
  const projectedGrade = gradeFromScore(scoreAfterFix);
  const showImprovementPill =
    criticalHighCount > 0 && projectedGrade !== scanData.grade;
  const improvementPill = showImprovementPill ? (
    <button
      type="button"
      onClick={() => {
        setActiveView('critical');
        document.getElementById('report-views')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
      style={{
        fontSize: 12, fontWeight: 600, color: '#059669',
        background: 'rgba(5,150,105,0.10)', border: '1px solid rgba(5,150,105,0.25)',
        borderRadius: 999, padding: '4px 10px', cursor: 'pointer',
      }}
    >
      ✨ Fix {criticalHighCount} {criticalHighCount === 1 ? 'finding' : 'findings'} → grade improves to {projectedGrade}
    </button>
  ) : null;

  // Modules with 0 findings on this scan — derived because real scans
  // pass moduleResults: {} from page.tsx.
  const findingsPerModule = scanData.findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.module] = (acc[f.module] ?? 0) + 1;
    return acc;
  }, {});
  const passedModules = SCAN_MODULES.filter((m) => (findingsPerModule[m.id] ?? 0) === 0);

  const sortedAll = [...gatedFindings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
  const criticalFindings = sortedAll.filter((f) => f.severity === 'CRITICAL');

  const isLockedAiPrompt = !tierMeta || tierMeta.tier === 'free';

  const execSummary =
    scanData.grade === 'D' || scanData.grade === 'F'
      ? <>This site has <strong style={{ color: 'var(--text)' }}>critical security issues</strong> that need immediate attention. Exposed secrets and misconfigured access controls put user data and finances at risk.</>
      : scanData.grade === 'C'
      ? <>This site has some security gaps that should be addressed. While no critical issues were found, the medium-severity findings reduce your overall security posture.</>
      : <>This site has a <strong style={{ color: 'var(--text)' }}>solid security posture</strong>. The remaining findings are minor improvements that would further harden your site.</>;

  const findingCardsList = (findings: Finding[]) =>
    findings.length === 0 ? (
      <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)', fontSize: 14 }}>
        Nothing to show in this view.
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {findings.map((finding) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            isExpanded={expandedId === finding.id}
            onToggle={() => setExpandedId(expandedId === finding.id ? null : finding.id)}
            cardStyle="elevated"
            isAiPromptLocked={isLockedAiPrompt}
          />
        ))}
      </div>
    );

  return (
    <div className="screen-enter" style={{ minHeight: '100vh', padding: '24px 24px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header card */}
        <div style={{
          backgroundColor: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
          padding: 32, marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
            <GradeDisplay grade={scanData.grade} size={140} style="ring" animated />
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <IconGlobe size={16} color="var(--text-tertiary)" />
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{scanData.url}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16, flexWrap: 'wrap' }}>
                <span>{scanData.stack}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IconClock size={12} /> {scanData.duration}
                </span>
                <span>{scanData.date}</span>
              </div>
              <SeveritySummary summary={scanData.summary} />
            </div>
          </div>

          {/* Executive summary */}
          <div style={{
            marginTop: 24, padding: '14px 16px', borderRadius: 10,
            backgroundColor: gradeConfig.bg, border: `1px solid ${gradeConfig.color}20`,
          }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {execSummary}
            </p>
          </div>
        </div>

        {/* Active Testing CTA Banner — sits between header and findings, matching
            the demo's order. Encourages active DAST testing as a next step. */}
        <aside
          aria-labelledby="active-test-cta-title"
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 14,
            border: '1px solid rgba(220,38,38,0.25)',
            background: 'linear-gradient(135deg, rgba(220,38,38,0.08), rgba(124,58,237,0.08))',
            padding: '20px 24px',
            marginBottom: 16,
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 280 }}>
            <div
              aria-hidden="true"
              style={{
                width: 40, height: 40, flexShrink: 0,
                borderRadius: 10,
                background: 'rgba(220,38,38,0.12)', color: '#DC2626',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}
            >
              🔴
            </div>
            <div>
              <h3 id="active-test-cta-title" style={{ fontSize: 14, fontWeight: 700, margin: '0 0 3px', color: 'var(--text)' }}>
                Go deeper: Run Active Security Test
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                {scanData.summary.CRITICAL > 0 ? (
                  <>
                    We found{' '}
                    <strong style={{ color: '#E11D48' }}>
                      {scanData.summary.CRITICAL} critical {scanData.summary.CRITICAL === 1 ? 'finding' : 'findings'}
                    </strong>
                    {' '}that may be exploitable. Confirm with real attack probes — SQLi, XSS, auth bypass.
                  </>
                ) : (
                  <>
                    Confirm passive findings with real attack probes — SQLi, XSS, auth bypass — rate-limited and opt-in.
                  </>
                )}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'right' }}>
              3 credits · ~8 min
              <br />
              Requires domain verify
            </div>
            <Link
              href={`/active-test?url=${encodeURIComponent(scanData.url)}`}
              style={{
                padding: '10px 20px',
                background: '#DC2626',
                color: '#fff',
                border: 'none',
                borderRadius: 9,
                fontSize: 14,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              Run Active Test →
            </Link>
          </div>
        </aside>

        {/* Grade Percentile + Improvement Bar (demo lines 3162-3170) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{
            background: gradeConfig.bg,
            border: `1px solid ${gradeConfig.color}33`,
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            color: gradeConfig.color,
            fontWeight: 600,
          }}>
            📊 {GRADE_BAND[scanData.grade]}
          </span>
          {improvementPill}
        </div>

        {/* CRITICAL urgency callout — shown only when there are CRITICAL findings.
            Includes a "View Critical Issues" button that switches to the critical view. */}
        {scanData.summary.CRITICAL > 0 && (
          <aside
            role="alert"
            style={{
              borderRadius: 14,
              border: '2px solid rgba(225,29,72,0.4)',
              background: 'linear-gradient(135deg, rgba(225,29,72,0.12), rgba(220,38,38,0.06))',
              padding: '20px 24px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 36, height: 36, flexShrink: 0,
                borderRadius: 10,
                background: 'rgba(225,29,72,0.18)', color: '#BE123C',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <IconAlertCircle size={20} color="#BE123C" />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#BE123C', lineHeight: 1.3, marginBottom: 4 }}>
                {scanData.summary.CRITICAL} CRITICAL {scanData.summary.CRITICAL === 1 ? 'issue needs' : 'issues need'} immediate action
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Most exposed secrets get scraped from public sources within 24-72 hours. The fix prompts below pair each issue with a copy-paste remediation.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveView('critical');
                document.getElementById('report-views')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              style={{
                padding: '10px 20px',
                background: '#E11D48',
                color: '#fff',
                border: 'none',
                borderRadius: 9,
                fontSize: 14,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              View Critical Issues →
            </button>
          </aside>
        )}

        {/* Tier gate banner */}
        {!loading && tierMeta && (
          <TierGateBanner
            isLimited={tierMeta.isLimited}
            tier={tierMeta.tier}
            total={tierMeta.total}
            shown={tierMeta.shown}
            hiddenCount={tierMeta.hiddenCount}
          />
        )}

        {/* Report filter tabs (demo lines 3183-3193) */}
        <div
          id="report-views"
          role="tablist"
          aria-label="Filter findings by view"
          style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', scrollMarginTop: 72 }}
        >
          {([
            { view: 'critical' as const, label: '🚨 Critical', count: criticalFindings.length, color: '#E11D48' },
            { view: 'all' as const, label: '📋 All Issues', count: gatedFindings.length, color: 'var(--text-tertiary)' },
            { view: 'passed' as const, label: '✅ Passed', count: passedModules.length, color: '#059669' },
          ]).map(({ view, label, count, color }) => {
            const active = activeView === view;
            return (
              <button
                key={view}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setActiveView(view)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 999,
                  border: '1px solid',
                  borderColor: active ? color : 'var(--border)',
                  background: active ? `${color}1A` : 'var(--surface)',
                  color: active ? color : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {label}
                <span style={{
                  background: color,
                  color: '#fff',
                  padding: '1px 7px',
                  borderRadius: 10,
                  fontSize: 11,
                  marginLeft: 2,
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* CRITICAL ISSUES VIEW */}
        {activeView === 'critical' && (
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {criticalFindings.length > 0
                ? <>Showing {criticalFindings.length} critical {criticalFindings.length === 1 ? 'issue' : 'issues'} — fix these first.</>
                : <>No critical issues found on this scan. Check the All Issues or Passed tabs.</>}
            </div>
            {findingCardsList(criticalFindings)}
          </div>
        )}

        {/* ALL ISSUES VIEW — grouped under a Security category header.
            Other categories (Performance/Accessibility/SEO) are rendered as
            their own scored sections below the findings list. */}
        {activeView === 'all' && (
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {gatedFindings.length > 0
                ? <>All {gatedFindings.length} {gatedFindings.length === 1 ? 'finding' : 'findings'} detected across Security{scanData.performanceData ? ', Performance' : ''}{scanData.accessibilityData ? ', Accessibility' : ''}{scanData.seoData ? ', SEO' : ''}.</>
                : <>No findings detected on this scan.</>}
            </div>

            {gatedFindings.length > 0 && (
              <>
                <div style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                  margin: '20px 0 10px',
                }}>
                  🛡️ Security
                </div>
                {findingCardsList(sortedAll)}
              </>
            )}

            {scanData.performanceData && scanData.id && (
              <>
                <div style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                  margin: '24px 0 10px',
                }}>
                  ⚡ Performance
                </div>
                <PerformanceSection
                  scanId={scanData.id}
                  performanceData={scanData.performanceData}
                />
              </>
            )}

            {scanData.accessibilityData && (
              <>
                <div style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                  margin: '24px 0 10px',
                }}>
                  ♿ Accessibility
                </div>
                <AccessibilitySection
                  accessibilityData={scanData.accessibilityData}
                  findings={gatedFindings}
                />
              </>
            )}

            {scanData.seoData && (
              <>
                <div style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                  margin: '24px 0 10px',
                }}>
                  🔍 SEO
                </div>
                <SEOSection
                  seoGrade={scanData.seoData.seoGrade}
                  seoScore={scanData.seoData.seoScore}
                  seoMetrics={scanData.seoData.seoMetrics}
                  findings={gatedFindings}
                />
              </>
            )}
          </div>
        )}

        {/* PASSED CHECKS VIEW */}
        {activeView === 'passed' && (
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {passedModules.length > 0
                ? <>{passedModules.length} {passedModules.length === 1 ? 'check' : 'checks'} passed — your site is already doing these things right.</>
                : <>No passed checks to show.</>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {passedModules.map((m) => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 10,
                  background: 'var(--surface)',
                  border: '1px solid rgba(5,150,105,0.2)',
                }}>
                  <span aria-hidden="true" style={{
                    width: 24, height: 24, borderRadius: 999,
                    background: '#059669',
                    color: '#fff',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <IconCheck size={14} color="#fff" />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{m.plainName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upgrade prompt (demo lines 3625-3634) — shown in all views.
            Two-button: $9 one-shot + $29 growth, gated to unauthed/free users. */}
        {!loading && (!tierMeta || tierMeta.tier === 'free') && scanData.findings.length > 0 && (
          <div
            id="upgrade-prompt"
            style={{
              background: 'linear-gradient(135deg, rgba(13,148,136,0.10), rgba(124,58,237,0.08))',
              border: '1px solid rgba(13,148,136,0.3)',
              borderRadius: 16,
              padding: '28px 32px',
              marginTop: 32,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>
              Fix all {scanData.findings.length} {scanData.findings.length === 1 ? 'finding' : 'findings'} with AI fix prompts
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>
              Get the exact Cursor / Lovable / v0 / Bolt prompt for every finding — AI codes the fix, you paste and deploy.
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
              No consultant fees, no subscription required. Starting at $9.
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                href="/pricing#one-shot"
                style={{
                  padding: '13px 28px', background: 'var(--accent)', color: '#fff',
                  border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                }}
              >
                Get AI Fix Prompts — $9 →
              </Link>
              <Link
                href="/pricing#growth"
                style={{
                  padding: '13px 28px',
                  background: 'transparent',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                Growth: 25 scans for $29
              </Link>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 14 }}>
              Credits never expire · Stripe-secured · 30-day refund guarantee
            </div>
          </div>
        )}
      </div>

      {/* Watermark for free tier */}
      {!loading && tierMeta && (
        <ReportWatermark tier={tierMeta.tier} isLimited={tierMeta.isLimited} />
      )}
    </div>
  );
}
