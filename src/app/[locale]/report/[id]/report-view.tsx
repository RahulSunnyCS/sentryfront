'use client';

import React from 'react';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { GRADE_CONFIG, SCAN_MODULES, SEVERITY_RANK } from '@/lib/data';
import type { ScanData, Finding } from '@/types';
import { mergeAndCalibrateFindings, compressInfoBandFindings, buildSummaryFromFindings } from '@/lib/report-utils';
import {
  deriveComplianceStatus,
  MODULE_FRAMEWORKS,
  FRAMEWORK_ORDER,
} from '@/lib/scanner/compliance-shared';
import { GradeDisplay } from '@/components/grade-display';
import { SeveritySummary } from '@/components/severity-summary';
import { FindingCard } from '@/components/finding-card';
import {
  ScanLevelMissedButton,
  ModuleMissedLink,
} from '@/components/scan-report/missed-issue-button';
import { IconGlobe, IconClock } from '@/components/icons';
import { PerformanceSection } from '@/components/performance-section';
import { AccessibilitySection } from '@/components/accessibility-section';
import { SEOSection } from '@/components/seo-section';

interface FindingsResponse {
  findings: Finding[];
}

type View = 'critical' | 'all' | 'passed';
type Tab = 'security' | 'performance' | 'accessibility' | 'seo' | 'compliance';

const MODULE_BY_ID = Object.fromEntries(SCAN_MODULES.map((m) => [m.id, m]));

export function ReportView({ scanData, authed = false }: { scanData: ScanData; authed?: boolean }) {
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

  const processedFindings = useMemo(
    () => compressInfoBandFindings(mergeAndCalibrateFindings(findings)).findings,
    [findings],
  );
  const processedSummary = useMemo(
    () => buildSummaryFromFindings(processedFindings),
    [processedFindings],
  );

  const gradeConfig = GRADE_CONFIG[scanData.grade];
  const criticalCount = processedSummary.CRITICAL;
  const highCount = processedSummary.HIGH;
  const totalFindings = processedFindings.length;
  const isAlarmingGrade = scanData.grade === 'D' || scanData.grade === 'F' || criticalCount > 0;

  const passedModules = useMemo(
    () => Object.entries(scanData.moduleResults)
      .filter(([, n]) => n === 0)
      .map(([id]) => MODULE_BY_ID[id])
      .filter((m): m is NonNullable<typeof m> => Boolean(m)),
    [scanData.moduleResults],
  );

  const securityFindings = useMemo(
    () => processedFindings.filter((f) => f.module.startsWith('P1-')),
    [processedFindings],
  );
  const performanceFindings = useMemo(
    () => processedFindings.filter((f) => f.module.startsWith('P2-')),
    [processedFindings],
  );
  const accessibilityFindings = useMemo(
    () => processedFindings.filter((f) => f.module.startsWith('P3-')),
    [processedFindings],
  );
  const seoFindings = useMemo(
    () => processedFindings.filter((f) => f.module.startsWith('P4-')),
    [processedFindings],
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

  const criticalFindings = securityFindings.filter((f) => f.severity === 'CRITICAL');

  const findingsByCategory = useMemo(() => {
    const groups: Record<string, Finding[]> = {};
    for (const f of securityFindings) {
      const key = f.category || 'Other';
      (groups[key] ??= []).push(f);
    }
    for (const list of Object.values(groups)) {
      list.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
    }
    return Object.entries(groups);
  }, [securityFindings]);

  const securityFindingsCount = securityFindings.length;

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
              <SeveritySummary summary={processedSummary} />
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
          <div data-testid="report-tabpanel" role="tabpanel" style={{ padding: 24 }}>
            {activeTab === 'security' && (
              <SecurityTabBody
                scanId={scanData.id ?? ''}
                authed={authed}
                view={view}
                setView={setView}
                criticalCount={criticalCount}
                totalFindings={securityFindingsCount}
                passedModules={passedModules}
                criticalFindings={criticalFindings}
                findingsByCategory={findingsByCategory}
                expandedId={expandedId}
                setExpandedId={setExpandedId}
              />
            )}
            {activeTab === 'performance' && scanData.performanceData && scanData.id && (
              <>
                <PerformanceSection
                  scanId={scanData.id}
                  performanceData={scanData.performanceData}
                />
                <TabFindingsList
                  findings={performanceFindings}
                  scanId={scanData.id}
                  authed={authed}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  emptyMessage="No performance findings detected."
                />
              </>
            )}
            {activeTab === 'accessibility' && scanData.accessibilityData && (
              <>
                <AccessibilitySection accessibilityData={scanData.accessibilityData} />
                <TabFindingsList
                  findings={accessibilityFindings}
                  scanId={scanData.id ?? ''}
                  authed={authed}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  emptyMessage="No accessibility findings detected."
                />
              </>
            )}
            {activeTab === 'seo' && scanData.seoData && (
              <>
                <SEOSection
                  seoGrade={scanData.seoData.seoGrade}
                  seoScore={scanData.seoData.seoScore}
                  seoMetrics={scanData.seoData.seoMetrics}
                />
                <TabFindingsList
                  findings={seoFindings}
                  scanId={scanData.id ?? ''}
                  authed={authed}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  emptyMessage="No SEO findings detected."
                />
              </>
            )}
            {activeTab === 'compliance' && <ComplianceSection findings={processedFindings} />}
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
              ~8 min · $0<br />Requires domain verify
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
  scanId, authed, view, setView, criticalCount, totalFindings, passedModules,
  criticalFindings, findingsByCategory, expandedId, setExpandedId,
}: {
  scanId: string;
  authed: boolean;
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <ScanLevelMissedButton scanId={scanId} authed={authed} />
      </div>
      <div data-testid="report-filter-tabs" role="tablist" aria-label="Filter findings" style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
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
                scanId={scanId}
                authed={authed}
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
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                margin: '20px 0 10px',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'var(--text-tertiary)',
                }}>
                  {category}
                </div>
                <ModuleMissedLink
                  scanId={scanId}
                  moduleId={list[0]?.module ?? 'unknown'}
                  authed={authed}
                />
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
          emoji="🧩"
          title="Chrome Extension"
          desc="Live security grades and alerts as you browse — no scan needed."
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

// ── Compliance signal derivation ─────────────────────────────────────────────
// deriveComplianceStatus, MODULE_FRAMEWORKS, and FRAMEWORK_ORDER are imported
// from @/lib/scanner/compliance-shared (single source of truth, C3 fix).
type ComplianceSignalStatus = 'observed' | 'not-observed' | 'not-evaluated';

interface FrameworkSignal {
  label: string;
  status: ComplianceSignalStatus;
}

function buildFrameworkSignals(
  p5Findings: Finding[],
  // Pre-computed status map passed in so each finding's status is derived once
  // and reused here (derive-once fix) and in the raw-findings list below.
  statusByFindingId: Map<string, ComplianceSignalStatus>,
): { framework: string; signals: FrameworkSignal[] }[] {
  // Seed all known frameworks so sections appear even with zero signals.
  const map = new Map<string, FrameworkSignal[]>(
    FRAMEWORK_ORDER.map((fw) => [fw, []]),
  );

  for (const finding of p5Findings) {
    // Extract the base module prefix (e.g. "P5-01" from "P5-01-cookie-consent").
    const moduleKey = finding.module.slice(0, 5); // "P5-XX"
    const frameworks = MODULE_FRAMEWORKS[moduleKey];
    if (!frameworks) continue;

    // Use the pre-computed status from the memoised map — never re-derive here.
    const status = statusByFindingId.get(finding.id) ?? 'not-evaluated';
    const label =
      finding.title.length <= 80 ? finding.title : finding.title.slice(0, 77) + '…';

    for (const fw of frameworks) {
      const signals = map.get(fw);
      if (signals) signals.push({ label, status });
    }
  }

  return FRAMEWORK_ORDER.filter((fw) => map.has(fw)).map((fw) => ({
    framework: fw,
    signals: map.get(fw)!,
  }));
}

// ── Status chip colour palette ────────────────────────────────────────────────
// Deliberately neutral: no red/green that implies pass/fail on a regulatory
// claim surface. Amber/blue/grey avoids accidental compliance verdicts.
const STATUS_CHIP_STYLE: Record<ComplianceSignalStatus, React.CSSProperties> = {
  observed: {
    background: 'rgba(13,148,136,0.10)',
    border: '1px solid rgba(13,148,136,0.30)',
    color: 'var(--accent)',
  },
  'not-observed': {
    background: 'rgba(234,179,8,0.10)',
    border: '1px solid rgba(234,179,8,0.35)',
    color: '#B45309',
  },
  'not-evaluated': {
    background: 'var(--surface-secondary)',
    border: '1px solid var(--border)',
    color: 'var(--text-tertiary)',
  },
};

function ComplianceDisclaimerBadge({ text }: { text: string }) {
  return (
    <div
      role="note"
      aria-label="Compliance disclaimer"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '10px 12px',
        background: 'rgba(234,179,8,0.07)',
        border: '1px solid rgba(234,179,8,0.30)',
        borderRadius: 8,
        marginBottom: 12,
        fontSize: 12,
        color: '#92400E',
        lineHeight: 1.5,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">⚠️</span>
      <span>{text}</span>
    </div>
  );
}

function ComplianceSection({ findings }: { findings: Finding[] }) {
  const t = useTranslations('report.compliance');

  // Filter to P5 findings only. If none exist (old scan / feature off), show the
  // empty state cleanly — no crash, no false compliance claim.
  const p5Findings = useMemo(
    () => findings.filter((f) => f.module.startsWith('P5-')),
    [findings],
  );

  // Derive each finding's status ONCE (Low fix: derive-once).
  // The Map is keyed by finding.id so both the framework-signals panel and the
  // raw-findings list consume the same pre-computed value without re-running the
  // derivation function per render.
  const statusByFindingId = useMemo(
    () => new Map(p5Findings.map((f) => [f.id, deriveComplianceStatus(f) as ComplianceSignalStatus])),
    [p5Findings],
  );

  const frameworkSignals = useMemo(
    () => buildFrameworkSignals(p5Findings, statusByFindingId),
    [p5Findings, statusByFindingId],
  );

  if (p5Findings.length === 0) {
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
          {t('emptyTitle')}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 auto', maxWidth: 480 }}>
          {t('emptyBody')}
        </p>
      </div>
    );
  }

  const statusLabel: Record<ComplianceSignalStatus, string> = {
    observed: t('signalObserved'),
    'not-observed': t('signalNotObserved'),
    'not-evaluated': t('signalNotEvaluated'),
  };

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
        {t('sectionTitle')}
      </div>

      {frameworkSignals.map(({ framework, signals }) => (
        <div
          key={framework}
          style={{
            marginBottom: 24,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '18px 20px',
          }}
        >
          {/* Framework heading */}
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--text-tertiary)',
            marginBottom: 12,
          }}>
            {framework}
          </div>

          {/* Disclaimer co-located with every framework block — never a single
              far-away line. This satisfies the acceptance criterion. */}
          <ComplianceDisclaimerBadge text={t('disclaimer')} />

          {/* Signal list */}
          {signals.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              {t('signalNotEvaluated')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {signals.map((sig, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    color: 'var(--text)',
                  }}
                >
                  {/* Status chip — neutral colour palette, not red/green */}
                  <span
                    style={{
                      flexShrink: 0,
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      ...STATUS_CHIP_STYLE[sig.status],
                    }}
                  >
                    {statusLabel[sig.status]}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{sig.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Raw P5 findings grouped by category, matching the pattern used by
          other tabs (TabFindingsList). Gives the user access to full
          finding detail (evidence, fix steps) without a numeric summary. */}
      {p5Findings.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--text-tertiary)',
            marginBottom: 16,
          }}>
            {t('findingsTitle')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {p5Findings.map((finding) => {
              // Look up the already-computed status — no double derivation.
              const status = statusByFindingId.get(finding.id) ?? 'not-evaluated';
              return (
              <div key={finding.id} style={{
                padding: '12px 14px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                fontSize: 13,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      ...STATUS_CHIP_STYLE[status],
                    }}
                  >
                    {statusLabel[status]}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{finding.title}</span>
                </div>
                {finding.explanation && (
                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {finding.explanation}
                  </p>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}
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
        Equivalent to a $3,200 security audit. Starting at just $0.
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link
          href="/checkout?plan=starter"
          style={{
            padding: '13px 28px', background: 'var(--accent)', color: 'white',
            borderRadius: 10, fontSize: 15, fontWeight: 700,
          }}
        >
          Get AI Fix Prompts — $0 →
        </Link>
        <Link
          href="/checkout?plan=growth"
          style={{
            padding: '13px 28px', background: 'transparent', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 10, fontSize: 15, fontWeight: 600,
          }}
        >
          Growth: 25 scans for $0
        </Link>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 14 }}>
        Credits never expire · Stripe-secured · 30-day refund guarantee
      </div>
    </div>
  );
}

function TabFindingsList({
  findings, scanId, authed, expandedId, setExpandedId, emptyMessage,
}: {
  findings: Finding[];
  scanId: string;
  authed: boolean;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  emptyMessage?: string;
}) {
  const byCategory = useMemo(() => {
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

  if (byCategory.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)', fontSize: 14 }}>
        {emptyMessage ?? 'No findings.'}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        {findings.length} {findings.length === 1 ? 'issue' : 'issues'} found.
      </div>
      {byCategory.map(([category, list]) => (
        <div key={category} style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            margin: '20px 0 10px',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--text-tertiary)',
            }}>
              {category}
            </div>
            <ModuleMissedLink
              scanId={scanId}
              moduleId={list[0]?.module ?? 'unknown'}
              authed={authed}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                isExpanded={expandedId === finding.id}
                onToggle={() => setExpandedId(expandedId === finding.id ? null : finding.id)}
                cardStyle="elevated"
                scanId={scanId}
                authed={authed}
              />
            ))}
          </div>
        </div>
      ))}
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
