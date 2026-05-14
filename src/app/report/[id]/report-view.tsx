'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { GRADE_CONFIG, SCAN_MODULES } from '@/lib/data';
import type { ScanData, Finding } from '@/types';
import { GradeDisplay } from '@/components/grade-display';
import { SeveritySummary } from '@/components/severity-summary';
import { FindingCard } from '@/components/finding-card';
import { IconGlobe, IconClock } from '@/components/icons';
import { PerformanceSection } from '@/components/performance-section';
import { AccessibilitySection } from '@/components/accessibility-section';
import { SEOSection } from '@/components/seo-section';

interface FindingsResponse {
  findings: Finding[];
}

type View = 'critical' | 'all' | 'passed';
type Tab = 'security' | 'performance' | 'accessibility' | 'seo' | 'compliance';

const SEVERITY_RANK: Record<Finding['severity'], number> = {
  CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4,
};

const MODULE_BY_ID = Object.fromEntries(SCAN_MODULES.map((m) => [m.id, m]));

export function ReportView({ scanData }: { scanData: ScanData }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
  const criticalCount = scanData.summary.CRITICAL ?? 0;
  const highCount = scanData.summary.HIGH ?? 0;
  const totalFindings = findings.length;
  const isAlarmingGrade = scanData.grade === 'D' || scanData.grade === 'F' || criticalCount > 0;

  const passedModules = useMemo(
    () => Object.entries(scanData.moduleResults)
      .filter(([, n]) => n === 0)
      .map(([id]) => MODULE_BY_ID[id])
      .filter((m): m is NonNullable<typeof m> => Boolean(m)),
    [scanData.moduleResults],
  );

  const [activeTab, setActiveTab] = useState<Tab>('security');
  const [view, setView] = useState<View>(criticalCount > 0 ? 'critical' : 'all');

  const percentileCopy: Record<typeof scanData.grade, string> = {
    A: 'Better than 90% of sites scanned',
    B: 'Better than 75% of sites scanned',
    C: 'Better than 50% of sites scanned',
    D: 'Better than 27% of sites scanned',
    F: 'In the bottom 15% of sites scanned',
  };

  const fixablePriority = criticalCount + highCount;
  const projectedGrade: typeof scanData.grade =
    scanData.grade === 'F' ? (fixablePriority >= 2 ? 'C' : 'D')
    : scanData.grade === 'D' ? (fixablePriority >= 2 ? 'B' : 'C')
    : scanData.grade === 'C' ? 'B'
    : scanData.grade === 'B' ? 'A'
    : 'A';

  const criticalFindings = findings.filter((f) => f.severity === 'CRITICAL');

  const findingsByCategory = useMemo(() => {
    const groups: Record<string, Finding[]> = {};
    for (const f of findings) {
      const key = f.category || 'Other';
      (groups[key] ??= []).push(f);
    }
    for (const list of Object.values(groups)) {
      list.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
    }
    return Object.entries(groups);
  }, [findings]);

  const execSummary =
    scanData.grade === 'D' || scanData.grade === 'F'
      ? <>This site has <strong style={{ color: 'var(--text)' }}>critical security issues</strong> that need immediate attention. Exposed secrets and misconfigured access controls put user data and finances at risk.</>
      : scanData.grade === 'C'
      ? <>This site has some security gaps that should be addressed. While no critical issues were found, the medium-severity findings reduce your overall security posture.</>
      : <>This site has a <strong style={{ color: 'var(--text)' }}>solid security posture</strong>. The remaining findings are minor improvements that would further harden your site.</>;

  const focusCritical = () => {
    setActiveTab('security');
    setView('critical');
  };

  const tabs: { id: Tab; emoji: string; label: string; visible: boolean }[] = [
    { id: 'security',      emoji: '🛡️', label: 'Security',      visible: true },
    { id: 'performance',   emoji: '⚡',  label: 'Performance',   visible: Boolean(scanData.performanceData) },
    { id: 'accessibility', emoji: '♿',  label: 'Accessibility', visible: Boolean(scanData.accessibilityData) },
    { id: 'seo',           emoji: '🔍', label: 'SEO',            visible: Boolean(scanData.seoData) },
    { id: 'compliance',    emoji: '🏛️', label: 'Compliance',    visible: true },
  ];

  return (
    <div className="screen-enter" style={{ minHeight: '100vh', padding: '24px 24px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Report Header */}
        <div style={{
          background: 'var(--surface)', borderRadius: 16,
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
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>{scanData.stack}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IconClock size={12} /> {scanData.duration}
                </span>
                <span>{scanData.date}</span>
              </div>
              <div style={{ marginBottom: 14 }}>
                <span
                  title="We only tested what an anonymous visitor can reach. Authenticated routes, admin flows, and post-login state weren't probed."
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 600,
                    color: 'var(--text-secondary)',
                    background: 'var(--surface-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '3px 8px',
                    cursor: 'help',
                  }}
                >
                  <span aria-hidden="true">🔓</span> Unauthenticated scope
                </span>
              </div>
              <SeveritySummary summary={scanData.summary} />
            </div>
          </div>

          <div style={{
            marginTop: 24, padding: '14px 16px', borderRadius: 10,
            background: gradeConfig.bg, border: `1px solid ${gradeConfig.color}20`,
          }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {execSummary}
            </p>
          </div>
        </div>

        {/* Percentile + Improvement chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{
            background: 'rgba(13,148,136,0.10)',
            border: '1px solid rgba(13,148,136,0.25)',
            borderRadius: 8, padding: '8px 14px',
            fontSize: 13, color: 'var(--accent)', fontWeight: 600,
          }}>
            📊 {percentileCopy[scanData.grade]}
          </div>
          {fixablePriority > 0 && projectedGrade !== scanData.grade && (
            <div style={{
              background: 'rgba(5,150,105,0.10)',
              border: '1px solid rgba(5,150,105,0.25)',
              borderRadius: 8, padding: '8px 14px',
              fontSize: 13, color: '#059669', fontWeight: 600,
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
            borderRadius: 14, padding: '20px 24px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
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
              onClick={focusCritical}
              style={{
                padding: '10px 20px', background: '#E11D48', color: 'white',
                border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              View Critical Issues →
            </button>
          </div>
        )}

        {/* Deeper-scan teaser — these issue classes don't surface in a passive scan */}
        <DeeperScansBox scanUrl={scanData.url} />

        {/* Unified Tabs Widget */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg)',
          marginBottom: 20,
          overflow: 'hidden',
        }}>
          {/* Tab strip */}
          <div
            role="tablist"
            aria-label="Report sections"
            style={{
              display: 'flex',
              gap: 0,
              borderBottom: '1px solid var(--border)',
              padding: '0 12px',
              overflowX: 'auto',
            }}
          >
            {tabs.filter((t) => t.visible).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '14px 16px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: 14,
                    fontWeight: active ? 700 : 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    marginBottom: -1,
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                >
                  <span aria-hidden="true">{tab.emoji}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab body */}
          <div role="tabpanel" style={{ padding: 24 }}>
            {activeTab === 'security' && (
              <SecurityTabBody
                view={view}
                setView={setView}
                criticalCount={criticalCount}
                totalFindings={totalFindings}
                passedModules={passedModules}
                criticalFindings={criticalFindings}
                findingsByCategory={findingsByCategory}
                expandedId={expandedId}
                setExpandedId={setExpandedId}
              />
            )}
            {activeTab === 'performance' && scanData.performanceData && scanData.id && (
              <PerformanceSection
                scanId={scanData.id}
                performanceData={scanData.performanceData}
              />
            )}
            {activeTab === 'accessibility' && scanData.accessibilityData && (
              <AccessibilitySection accessibilityData={scanData.accessibilityData} />
            )}
            {activeTab === 'seo' && scanData.seoData && (
              <SEOSection
                seoGrade={scanData.seoData.seoGrade}
                seoScore={scanData.seoData.seoScore}
                seoMetrics={scanData.seoData.seoMetrics}
              />
            )}
            {activeTab === 'compliance' && <CompliancePlaceholder />}
          </div>
        </div>

        {/* Active Testing CTA Banner */}
        <aside
          aria-labelledby="active-test-cta-title"
          style={{
            position: 'relative', overflow: 'hidden',
            borderRadius: 14,
            border: isAlarmingGrade
              ? '1px solid rgba(220,38,38,0.25)'
              : '1px solid var(--border)',
            background: isAlarmingGrade
              ? 'linear-gradient(135deg, rgba(220,38,38,0.08), rgba(124,58,237,0.08))'
              : 'var(--surface)',
            padding: '20px 24px',
            marginBottom: 20,
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
                borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isAlarmingGrade ? 'rgba(220,38,38,0.12)' : 'var(--surface-secondary)',
                fontSize: 18,
              }}
            >
              {isAlarmingGrade ? '🔴' : '🛡️'}
            </div>
            <div>
              <h3 id="active-test-cta-title" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 3px' }}>
                {isAlarmingGrade ? 'Go deeper: Run Active Security Test' : 'Add active DAST for extra confidence'}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                {isAlarmingGrade ? (
                  <>We found <strong style={{ color: '#E11D48' }}>{criticalCount} critical {criticalCount === 1 ? 'finding' : 'findings'}</strong> that may be exploitable. Confirm with real attack probes — SQL injection, XSS, API fuzzing.</>
                ) : (
                  <>Even a clean passive scan can miss exploitable logic flaws. Active DAST sends real attack probes against your verified domain.</>
                )}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'right' }}>
              ~8 min · $9<br />Requires domain verify
            </div>
            <Link
              href={`/active-test?url=${encodeURIComponent(scanData.url)}`}
              style={{
                padding: '10px 20px',
                background: isAlarmingGrade ? '#DC2626' : 'var(--accent)',
                color: 'white', borderRadius: 9, fontSize: 14, fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              Run Active Test →
            </Link>
          </div>
        </aside>

        {/* Bottom upgrade prompt */}
        <UpgradePrompt totalFindings={totalFindings} grade={scanData.grade} />

      </div>
    </div>
  );
}

function SecurityTabBody({
  view, setView, criticalCount, totalFindings, passedModules,
  criticalFindings, findingsByCategory, expandedId, setExpandedId,
}: {
  view: View;
  setView: (v: View) => void;
  criticalCount: number;
  totalFindings: number;
  passedModules: { id: string; name: string; plainName: string }[];
  criticalFindings: Finding[];
  findingsByCategory: [string, Finding[]][];
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}) {
  return (
    <div>
      <div role="tablist" aria-label="Filter findings" style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <FilterButton
          active={view === 'critical'}
          onClick={() => setView('critical')}
          label="Critical"
          emoji="🚨"
          count={criticalCount}
          countBg="#E11D48"
        />
        <FilterButton
          active={view === 'all'}
          onClick={() => setView('all')}
          label="All Issues"
          emoji="📋"
          count={totalFindings}
          countBg="var(--text-tertiary)"
        />
        <FilterButton
          active={view === 'passed'}
          onClick={() => setView('passed')}
          label="Passed"
          emoji="✅"
          count={passedModules.length}
          countBg="#059669"
        />
      </div>

      {view === 'critical' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            {criticalCount === 0
              ? 'No critical issues. Nice work — review the All Issues tab for lower-severity findings.'
              : `Showing ${criticalCount} critical ${criticalCount === 1 ? 'issue' : 'issues'} across all categories — fix these first.`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {criticalFindings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                isExpanded={expandedId === finding.id}
                onToggle={() => setExpandedId(expandedId === finding.id ? null : finding.id)}
                cardStyle="elevated"
              />
            ))}
          </div>
        </div>
      )}

      {view === 'all' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            All {totalFindings} {totalFindings === 1 ? 'issue' : 'issues'} found across all checks.
          </div>
          {findingsByCategory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)', fontSize: 14 }}>
              No findings.
            </div>
          ) : findingsByCategory.map(([category, list]) => (
            <div key={category} style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                margin: '20px 0 10px',
              }}>
                {category}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {list.map((finding) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    isExpanded={expandedId === finding.id}
                    onToggle={() => setExpandedId(expandedId === finding.id ? null : finding.id)}
                    cardStyle="elevated"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'passed' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            {passedModules.length === 0
              ? 'No checks passed cleanly on this scan.'
              : `${passedModules.length} ${passedModules.length === 1 ? 'check' : 'checks'} passed — your site is already doing these things right.`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {passedModules.map((mod) => (
              <div key={mod.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '14px 16px',
                background: 'var(--surface)',
                border: '1px solid rgba(5,150,105,0.2)',
                borderRadius: 10,
              }}>
                <span style={{
                  width: 24, height: 24,
                  background: '#059669', color: 'white',
                  borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  flexShrink: 0, marginTop: 1,
                }} aria-hidden="true">✓</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{mod.plainName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{mod.name} — no issues detected.</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DeeperScansBox({ scanUrl }: { scanUrl: string }) {
  return (
    <div
      aria-labelledby="deeper-scans-title"
      style={{
        background: 'linear-gradient(135deg, rgba(13,148,136,0.07), rgba(124,58,237,0.05))',
        border: '1px solid rgba(13,148,136,0.25)',
        borderRadius: 14,
        padding: '20px 22px',
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 22 }} aria-hidden="true">🔎</span>
        <div>
          <h3 id="deeper-scans-title" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            We only tested your public, unauthenticated surface — these scans cover what we missed
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.5 }}>
            Some issue classes only surface with authenticated sessions, source-code access, or live exploit probes.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        <DeeperScanCard
          emoji="🔐"
          title="Auth-only flaws"
          desc="Broken access control, IDOR, privileged endpoints."
          ctaLabel="Run active test →"
          href={`/active-test?url=${encodeURIComponent(scanUrl)}`}
        />
        <DeeperScanCard
          emoji="🐙"
          title="Source-code findings"
          desc="Hardcoded secrets, vulnerable deps, SSRF gadgets."
          comingSoon
        />
        <DeeperScanCard
          emoji="🎯"
          title="Live exploit probes"
          desc="SQL injection, XSS, API fuzzing — proven by real attacks."
          ctaLabel="Run active test →"
          href={`/active-test?url=${encodeURIComponent(scanUrl)}`}
        />
      </div>
    </div>
  );
}

function DeeperScanCard({
  emoji, title, desc, ctaLabel, href, comingSoon,
}: {
  emoji: string;
  title: string;
  desc: string;
  ctaLabel?: string;
  href?: string;
  comingSoon?: boolean;
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }} aria-hidden="true">{emoji}</span>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</div>
      {comingSoon ? (
        <span style={{
          alignSelf: 'flex-start',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-tertiary)',
          background: 'var(--surface-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '3px 8px',
          marginTop: 2,
        }}>
          Coming soon
        </span>
      ) : (
        <Link
          href={href!}
          style={{
            alignSelf: 'flex-start',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--accent)',
            marginTop: 2,
          }}
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

function CompliancePlaceholder() {
  return (
    <div style={{
      background: 'var(--surface-secondary)',
      border: '1px dashed var(--border)',
      borderRadius: 12,
      padding: '28px 24px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 28, marginBottom: 12 }} aria-hidden="true">🏛️</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
        Compliance checks — coming soon
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 auto', maxWidth: 480 }}>
        Automated signal-gathering for regulatory frameworks (GDPR, PCI-DSS, CCPA) will surface here when the
        Phase 4.9 compliance modules ship. We won&apos;t make compliance claims we can&apos;t back with specific checks.
      </p>
    </div>
  );
}

function UpgradePrompt({ totalFindings, grade }: { totalFindings: number; grade: ScanData['grade'] }) {
  const isClean = totalFindings === 0;
  const heading = isClean
    ? 'Keep your ' + grade + ' grade — re-scan monthly with AI fix prompts'
    : `Fix all ${totalFindings} ${totalFindings === 1 ? 'issue' : 'issues'} with AI in 30 minutes`;
  const subtext = isClean
    ? 'Schedule monthly re-scans and get AI-generated fix prompts the moment something regresses.'
    : 'Get the exact Cursor prompts for every finding — AI codes the fix, you paste and deploy.';

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(13,148,136,0.10), rgba(124,58,237,0.08))',
      border: '1px solid rgba(13,148,136,0.3)',
      borderRadius: 16,
      padding: '28px 32px',
      marginTop: 12,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
        {heading}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {subtext}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
        Equivalent to a $3,200 security audit. Starting at just $9.
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link
          href="/checkout?plan=starter"
          style={{
            padding: '13px 28px', background: 'var(--accent)', color: 'white',
            borderRadius: 10, fontSize: 15, fontWeight: 700,
          }}
        >
          Get AI Fix Prompts — $9 →
        </Link>
        <Link
          href="/checkout?plan=growth"
          style={{
            padding: '13px 28px', background: 'transparent', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 10, fontSize: 15, fontWeight: 600,
          }}
        >
          Growth: 25 scans for $29
        </Link>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 14 }}>
        Credits never expire · Stripe-secured · 30-day refund guarantee
      </div>
    </div>
  );
}

function FilterButton({
  active, onClick, label, emoji, count, countBg,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  emoji: string;
  count: number;
  countBg: string;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '9px 16px',
        background: active ? 'rgba(13,148,136,0.10)' : 'var(--surface)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 9,
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        fontSize: 13, fontWeight: 600,
        cursor: 'pointer', whiteSpace: 'nowrap',
        transition: 'all 0.2s',
      }}
    >
      <span aria-hidden="true">{emoji}</span>
      {label}
      <span style={{
        background: countBg, color: 'white',
        padding: '1px 7px', borderRadius: 10,
        fontSize: 11, marginLeft: 4,
      }}>{count}</span>
    </button>
  );
}
