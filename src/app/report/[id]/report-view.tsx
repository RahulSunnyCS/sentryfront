'use client';

import { useState, useEffect } from 'react';
import { GRADE_CONFIG } from '@/lib/data';
import type { ScanData, Severity, Finding } from '@/types';
import { GradeDisplay } from '@/components/grade-display';
import { SeveritySummary } from '@/components/severity-summary';
import { FindingCard } from '@/components/finding-card';
import { IconGlobe, IconClock } from '@/components/icons';
import { TierGateBanner } from '@/components/tier-gate-banner';
import { ReportWatermark } from '@/components/report-watermark';

const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

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

export function ReportView({ scanData }: { scanData: ScanData }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | Severity>('ALL');
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

  const filtered = filterSeverity === 'ALL'
    ? gatedFindings
    : gatedFindings.filter((f) => f.severity === filterSeverity);

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

        {/* Findings header + filter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            Findings ({sorted.length})
          </h2>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(['ALL', ...activeSeverities] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                  cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  backgroundColor: filterSeverity === sev ? 'var(--text)' : 'var(--surface)',
                  color: filterSeverity === sev ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                  textTransform: sev === 'ALL' ? 'none' : 'capitalize',
                }}
              >
                {sev === 'ALL' ? 'All' : sev.charAt(0) + sev.slice(1).toLowerCase()}
              </button>
            ))}
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

      {/* Watermark for free tier */}
      {!loading && tierMeta && (
        <ReportWatermark tier={tierMeta.tier} isLimited={tierMeta.isLimited} />
      )}
    </div>
  );
}
