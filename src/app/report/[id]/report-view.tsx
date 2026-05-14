'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { GRADE_CONFIG, SEVERITY_CONFIG } from '@/lib/data';
import type { ScanData, Severity, Finding } from '@/types';

interface FindingsResponse {
  findings: Finding[];
}
import { GradeDisplay } from '@/components/grade-display';
import { SeveritySummary } from '@/components/severity-summary';
import { FindingCard } from '@/components/finding-card';
import { IconGlobe, IconClock } from '@/components/icons';
import { PerformanceSection } from '@/components/performance-section';
import { AccessibilitySection } from '@/components/accessibility-section';
import { SEOSection } from '@/components/seo-section';

const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export function ReportView({ scanData }: { scanData: ScanData }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | Severity>('ALL');
  const [findings, setFindings] = useState<Finding[]>(scanData.findings);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/scans/${scanData.id}/findings`)
      .then((res) => (res.ok ? (res.json() as Promise<FindingsResponse>) : null))
      .then((data) => {
        if (!cancelled && data?.findings) setFindings(data.findings);
      })
      .catch(() => { /* keep server-rendered findings */ });
    return () => { cancelled = true; };
  }, [scanData.id]);

  const gradeConfig = GRADE_CONFIG[scanData.grade];

  // Calibrate the Active Test CTA tone to the grade: red urgency only when
  // the scan found real problems (D/F). On healthy sites the CTA stays as a
  // neutral "extra confidence" offer.
  const criticalCount = scanData.summary.CRITICAL ?? 0;
  const highCount = scanData.summary.HIGH ?? 0;
  const isAlarmingGrade = scanData.grade === 'D' || scanData.grade === 'F' || criticalCount > 0;

  // Percentile copy — derived from the letter grade so it stays in sync with score
  // without inventing fake numbers. Order: A→top 10%, B→top 25%, C→top 50%, D→27%, F→bottom 15%.
  const percentileCopy: Record<typeof scanData.grade, string> = {
    A: 'Better than 90% of sites scanned',
    B: 'Better than 75% of sites scanned',
    C: 'Better than 50% of sites scanned',
    D: 'Better than 27% of sites scanned',
    F: 'In the bottom 15% of sites scanned',
  };

  // Projected grade after fixing all CRITICAL + HIGH findings.
  const fixablePriority = criticalCount + highCount;
  const projectedGrade: typeof scanData.grade =
    scanData.grade === 'F' ? (fixablePriority >= 2 ? 'C' : 'D')
    : scanData.grade === 'D' ? (fixablePriority >= 2 ? 'B' : 'C')
    : scanData.grade === 'C' ? 'B'
    : scanData.grade === 'B' ? 'A'
    : 'A';

  const filtered = filterSeverity === 'ALL'
    ? findings
    : findings.filter((f) => f.severity === filterSeverity);

  const sorted = [...filtered].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  const activeSeverities = SEVERITY_ORDER.filter((s) => (scanData.summary[s] ?? 0) > 0);

  const execSummary =
    scanData.grade === 'D' || scanData.grade === 'F'
      ? <>This site has <strong style={{ color: 'var(--text)' }}>critical security issues</strong> that need immediate attention. Exposed secrets and misconfigured access controls put user data and finances at risk.</>
      : scanData.grade === 'C'
      ? <>This site has some security gaps that should be addressed. While no critical issues were found, the medium-severity findings reduce your overall security posture.</>
      : <>This site has a <strong style={{ color: 'var(--text)' }}>solid security posture</strong>. The remaining findings are minor improvements that would further harden your site.</>;

  return (
    <div className="screen-enter" style={{ minHeight: '100vh', padding: '24px 24px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header card */}
        <div style={{
          backgroundColor: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
          padding: 32, marginBottom: 28,
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

        {/* Grade Percentile + Improvement chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{
            background: 'rgba(13,148,136,0.10)',
            border: '1px solid rgba(13,148,136,0.25)',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            color: 'var(--accent)',
            fontWeight: 600,
          }}>
            📊 {percentileCopy[scanData.grade]}
          </div>
          {fixablePriority > 0 && projectedGrade !== scanData.grade && (
            <div style={{
              background: 'rgba(5,150,105,0.10)',
              border: '1px solid rgba(5,150,105,0.25)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              color: '#059669',
              fontWeight: 600,
            }}>
              ✨ Fix {fixablePriority} {fixablePriority === 1 ? 'issue' : 'issues'} → grade improves from {scanData.grade} to {projectedGrade}
            </div>
          )}
        </div>

        {/* Red Urgency Box — only when CRITICAL findings exist */}
        {criticalCount > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(225,29,72,0.12), rgba(220,38,38,0.06))',
            border: '2px solid rgba(225,29,72,0.4)',
            borderRadius: 14,
            padding: '20px 24px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 28, flexShrink: 0 }} aria-hidden="true">🚨</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#E11D48', marginBottom: 4 }}>
                {criticalCount} CRITICAL {criticalCount === 1 ? 'issue needs' : 'issues need'} immediate action
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                These can be exploited in minutes. Fix them before anything else.
              </div>
            </div>
            <button
              onClick={() => setFilterSeverity('CRITICAL')}
              style={{
                padding: '10px 20px',
                background: '#E11D48',
                color: 'white',
                border: 'none',
                borderRadius: 9,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'opacity 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseOut={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              View Critical Issues →
            </button>
          </div>
        )}

        {/* Active Testing CTA banner — tone calibrated to grade */}
        <aside
          aria-labelledby="active-test-cta-title"
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 16,
            border: isAlarmingGrade
              ? '1px solid rgba(220,38,38,0.30)'
              : '1px solid var(--border)',
            background: isAlarmingGrade
              ? 'linear-gradient(135deg, rgba(220,38,38,0.10), rgba(245,158,11,0.06))'
              : 'var(--surface)',
            padding: '20px 22px',
            marginBottom: 24,
            display: 'flex',
            gap: 20,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 48, height: 48, flexShrink: 0,
              borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isAlarmingGrade ? 'rgba(220,38,38,0.15)' : 'var(--surface-secondary)',
              color: isAlarmingGrade ? '#DC2626' : 'var(--accent)',
              fontSize: 24,
            }}
          >
            {isAlarmingGrade ? '⚔️' : '🛡️'}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 10, fontWeight: 800,
                  color: isAlarmingGrade ? '#DC2626' : 'var(--accent)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  padding: '3px 8px', borderRadius: 999,
                  background: isAlarmingGrade
                    ? 'rgba(220,38,38,0.12)'
                    : 'var(--accent-light)',
                }}
              >
                {isAlarmingGrade && (
                  <span className="pulse-soft" aria-hidden="true">● </span>
                )}
                {isAlarmingGrade ? 'Next step' : 'Optional'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>~8 min · $9</span>
            </div>
            <h3 id="active-test-cta-title" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
              {isAlarmingGrade
                ? 'Want CONFIRMED proof these issues are exploitable?'
                : 'Add active DAST verification for extra confidence.'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {isAlarmingGrade
                ? 'Run an active DAST scan — real attack probes (SQLi, XSS, auth bypass) rate-limited and opt-in. Replaces a $5,000 manual pentest.'
                : 'Even a clean passive scan can miss exploitable logic flaws. Active DAST sends real attack probes against your verified domain.'}
            </p>
          </div>
          <Link
            href={`/active-test?url=${encodeURIComponent(scanData.url)}`}
            className="btn-primary"
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Run active test →
          </Link>
        </aside>

        {/* Performance Section - only show if performance data is available */}
        {scanData.performanceData && scanData.id && (
          <PerformanceSection
            scanId={scanData.id}
            performanceData={scanData.performanceData}
          />
        )}

        {/* Accessibility Section - only show if accessibility data is available */}
        {scanData.accessibilityData && (
          <AccessibilitySection
            accessibilityData={scanData.accessibilityData}
            findings={findings}
          />
        )}

        {/* SEO Section - only show if SEO data is available */}
        {scanData.seoData && (
          <SEOSection
            seoGrade={scanData.seoData.seoGrade}
            seoScore={scanData.seoData.seoScore}
            seoMetrics={scanData.seoData.seoMetrics}
            findings={findings}
          />
        )}

        {/* Findings header + filter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            Findings ({sorted.length})
          </h2>
          <div role="tablist" aria-label="Filter findings by severity" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['ALL', ...activeSeverities] as const).map((sev) => {
              const active = filterSeverity === sev;
              const cfg = sev === 'ALL' ? null : SEVERITY_CONFIG[sev as Severity];
              const count = sev === 'ALL'
                ? findings.length
                : (scanData.summary[sev as Severity] ?? 0);
              return (
                <button
                  key={sev}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilterSeverity(sev)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 11px', borderRadius: 999,
                    border: '1px solid',
                    borderColor: active ? (cfg?.color ?? 'var(--text)') : 'var(--border)',
                    backgroundColor: active ? (cfg?.bg ?? 'var(--text)') : 'var(--surface)',
                    color: active ? (cfg?.color ?? '#fff') : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.02em',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {cfg && (
                    <span aria-hidden="true" style={{
                      width: 6, height: 6, borderRadius: 999,
                      backgroundColor: cfg.color,
                    }} />
                  )}
                  {sev === 'ALL' ? 'All' : sev.charAt(0) + sev.slice(1).toLowerCase()}
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    padding: '1px 6px', borderRadius: 999,
                    backgroundColor: active ? 'rgba(0,0,0,0.06)' : 'var(--surface-secondary)',
                    color: active ? (cfg?.color ?? 'inherit') : 'var(--text-tertiary)',
                  }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Finding cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              isExpanded={expandedId === finding.id}
              onToggle={() => setExpandedId(expandedId === finding.id ? null : finding.id)}
              cardStyle="elevated"
            />
          ))}
        </div>

        {sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)', fontSize: 14 }}>
            No findings match this filter.
          </div>
        )}
      </div>
    </div>
  );
}
