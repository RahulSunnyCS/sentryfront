import { GRADE_CONFIG, SCAN_MODULES, SEVERITY_RANK } from '@/lib/data';
import type { Finding, Grade, ScanData } from '@/types';
import {
  mergeAndCalibrateFindings,
  compressInfoBandFindings,
  buildSummaryFromFindings,
  type BandSummaryItem,
} from '@/lib/report-utils';
import { AutoPrint } from './auto-print';
import {
  deriveComplianceStatus,
  MODULE_FRAMEWORKS,
  FRAMEWORK_ORDER,
} from '@/lib/scanner/compliance-shared';

// ── Compliance signal derivation ─────────────────────────────────────────────
// The derive function, MODULE_FRAMEWORKS, and FRAMEWORK_ORDER are now imported
// from @/lib/scanner/compliance-shared (single source of truth, C3 fix).
// The local copies (derivePrintComplianceStatus, P5_MODULE_FRAMEWORKS_PRINT,
// FRAMEWORK_ORDER_PRINT) have been removed; they were byte-equivalent to the
// shared module — no drift found.
type PrintComplianceSignalStatus = 'observed' | 'not-observed' | 'not-evaluated';

interface PrintFrameworkSignal {
  label: string;
  status: PrintComplianceSignalStatus;
}

function buildPrintFrameworkSignals(
  p5Findings: Finding[],
): { framework: string; signals: PrintFrameworkSignal[] }[] {
  // Seed all known frameworks so per-framework disclaimer blocks render even
  // when a framework has zero signals from the current findings set.
  const map = new Map<string, PrintFrameworkSignal[]>(
    FRAMEWORK_ORDER.map((fw) => [fw, []]),
  );
  for (const finding of p5Findings) {
    const moduleKey = finding.module.slice(0, 5);
    const frameworks = MODULE_FRAMEWORKS[moduleKey];
    if (!frameworks) continue;
    const status = deriveComplianceStatus(finding) as PrintComplianceSignalStatus;
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

// The disclaimer string is in English in the print path intentionally:
// PDF/print is consumed as a static document and cannot use next-intl at
// render time (this is a Server Component). The English string is the
// reviewed, legally safe version — same policy as the i18n fallback.
const COMPLIANCE_DISCLAIMER_EN =
  'Not legal advice. Not a compliance attestation. Signal detection only.';

interface Props {
  scanData: ScanData;
  reportId: string;
  scanId: string;
  preparedFor: string | null;
  issuedAtIso: string;
  validUntilIso: string;
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
}

const SCANNER_VERSION = 'v0.4.2';
const FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return FORMATTER.format(new Date(iso));
  } catch {
    return '—';
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function gradeBarTone(score: number): 'good' | 'warn' | 'bad' {
  if (score >= 75) return 'good';
  if (score >= 50) return 'warn';
  return 'bad';
}

function dashOffsetForScore(score: number): number {
  // SVG ring uses circumference ≈ 327 for r=52. Stroke length = score/100 * 327.
  const circumference = 2 * Math.PI * 52;
  return Math.max(0, Math.min(circumference, (score / 100) * circumference));
}

function verdictFor(grade: Grade, critical: number): {
  headline: string;
  body: string;
} {
  if (grade === 'D' || grade === 'F') {
    return {
      headline: 'Critical action required',
      body:
        'This site has security gaps that put user data and trust at risk. Address the priority findings before anything else; many are single-line header changes or config tweaks.',
    };
  }
  if (grade === 'C') {
    return {
      headline: 'Solid foundations — a handful of fixes raise this to a B',
      body:
        critical > 0
          ? 'Critical findings exist but the broader posture is reasonable. Close the priority items first; the rest can be batched.'
          : 'No critical issues. A small set of medium-severity fixes will move you up a grade and tighten defense-in-depth.',
    };
  }
  return {
    headline: 'Strong posture — keep it that way',
    body:
      'Remaining findings are minor improvements. Schedule periodic re-scans so regressions get caught early.',
  };
}

function GradeRing({ grade, score }: { grade: Grade; score: number }) {
  const cfg = GRADE_CONFIG[grade];
  const offset = dashOffsetForScore(score);
  return (
    <div className="grade-ring" aria-label={`Overall grade ${grade}, ${score} out of 100`}>
      <svg viewBox="0 0 120 120" role="img">
        <circle cx="60" cy="60" r="52" fill="none" stroke="#F3F4F6" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke={cfg.color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${offset} 1000`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="letter" style={{ color: cfg.color }}>
        {grade}
      </div>
    </div>
  );
}

function RunningHeader({ host, dateLabel, reportId }: { host: string; dateLabel: string; reportId: string }) {
  return (
    <header className="running-header">
      <span className="brand">
        <span className="brand-mark">V</span> VibeSafe · {host}
      </span>
      <span className="meta">
        {dateLabel} · Report {reportId}
      </span>
    </header>
  );
}

function RunningFooter({ scanId, page, total }: { scanId: string; page: number; total: number }) {
  return (
    <footer className="running-footer">
      <span>
        VibeSafe Report · <a href="https://vibesafe.app">vibesafe.app</a>
      </span>
      <span className="scan-id">
        scan_{scanId.slice(0, 12)} · Page {String(page).padStart(2, '0')} of {String(total).padStart(2, '0')}
      </span>
    </footer>
  );
}

function FindingCardPrint({ finding, idx }: { finding: Finding; idx?: number }) {
  const sev = finding.severity.toLowerCase();
  const fixSteps = finding.fixManual.slice(0, 4);
  return (
    <article className="finding">
      <div className="finding-head">
        <span className={`severity-chip ${sev}`}>{finding.severity}</span>
        <h4>
          {idx !== undefined ? `${idx}. ` : ''}
          {finding.title}
        </h4>
        <span className="finding-id">{finding.module}</span>
      </div>
      <div className="finding-meta">
        <span>📁 {finding.category}</span>
        {finding.location && <span>🎯 {finding.location}</span>}
      </div>
      <div className="finding-body">
        {finding.explanation && <p>{finding.explanation}</p>}
        {finding.impact && (
          <>
            <h5>Impact</h5>
            <p>{finding.impact}</p>
          </>
        )}
        {finding.evidence && (
          <>
            <h5>Evidence</h5>
            <pre className="evidence">{finding.evidence}</pre>
          </>
        )}
        {fixSteps.length > 0 && (
          <>
            <h5>Remediation</h5>
            <ul>
              {fixSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </article>
  );
}

function FindingBackRef({ finding, idx }: { finding: Finding; idx: number }) {
  const sev = finding.severity.toLowerCase();
  return (
    <div className="finding-ref">
      <span className={`severity-chip ${sev}`}>{finding.severity}</span>
      <span className="finding-ref-title">{finding.title}</span>
      <span className="finding-ref-pointer">→ Priority findings #{idx}</span>
      <span className="finding-id">{finding.module}</span>
    </div>
  );
}

function BandSummaryCallout({ items }: { items: BandSummaryItem[] }) {
  return (
    <div className="callout" style={{ marginTop: '4mm', padding: '4mm 5mm' }}>
      <strong style={{ display: 'block', marginBottom: '2mm' }}>Core Web Vitals — band summary</strong>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--pdoc-border)' }}>
            <th style={{ textAlign: 'left', padding: '1mm 2mm 1mm 0', fontWeight: 700, color: 'var(--pdoc-text-3)' }}>Metric</th>
            <th style={{ textAlign: 'right', padding: '1mm 0', fontWeight: 700, color: 'var(--pdoc-text-3)' }}>Value</th>
            <th style={{ textAlign: 'right', padding: '1mm 0', fontWeight: 700, color: 'var(--pdoc-text-3)' }}>Band</th>
            <th style={{ textAlign: 'right', padding: '1mm 0', fontWeight: 700, color: 'var(--pdoc-text-3)' }}>Threshold</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.metric}>
              <td style={{ padding: '1.5mm 2mm 1.5mm 0', fontWeight: 600 }}>{item.metric}</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--pdoc-mono)', padding: '1.5mm 0' }}>{item.value}</td>
              <td style={{ textAlign: 'right', padding: '1.5mm 0' }}>{item.band}</td>
              <td style={{ textAlign: 'right', color: 'var(--pdoc-text-3)', padding: '1.5mm 0' }}>{item.threshold}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PrintReport(props: Props) {
  const {
    scanData,
    reportId,
    scanId,
    preparedFor,
    issuedAtIso,
    validUntilIso,
    performanceScore,
    accessibilityScore,
    seoScore,
  } = props;

  const host = hostnameOf(scanData.url);
  const dateLabel = scanData.date;
  const filename = `vibesafe-${host}-${new Date(issuedAtIso).toISOString().slice(0, 10)}.pdf`;

  const clampedScore = Math.min(100, scanData.score);
  const { findings: calibratedFindings, bandSummary } = compressInfoBandFindings(
    mergeAndCalibrateFindings(scanData.findings),
  );

  const findings = [...calibratedFindings].sort((a, b) => {
    const r = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (r !== 0) return r;
    return a.category.localeCompare(b.category);
  });

  const totalFindings = findings.length;
  const summary = buildSummaryFromFindings(findings);
  const passedCount = Math.max(0, SCAN_MODULES.length - new Set(findings.map((f) => f.module)).size);

  const findingsByCategory = (() => {
    const groups: Record<string, Finding[]> = {};
    for (const f of findings) {
      const key = f.category || 'Other';
      (groups[key] ??= []).push(f);
    }
    return Object.entries(groups);
  })();

  const priorityFindings = findings
    .filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')
    .slice(0, 5);

  const passedModules = SCAN_MODULES.filter(
    (m) => !findings.some((f) => f.module === m.id),
  );

  const verdict = verdictFor(scanData.grade, summary.CRITICAL);

  // ── Compliance data (derived from persisted P5 findings — no extra fetch) ───
  const p5Findings = findings.filter((f) => f.module.startsWith('P5-'));
  const hasComplianceFindings = p5Findings.length > 0;
  const complianceFrameworks = buildPrintFrameworkSignals(p5Findings);

  // ── Page numbering — only count pages we actually render
  const pages: { id: string; pageNumber: number }[] = [];
  let pageCounter = 1;
  const addPage = (id: string) => {
    pages.push({ id, pageNumber: pageCounter });
    pageCounter += 1;
    return pages[pages.length - 1].pageNumber;
  };
  // Cover doesn't get a "page X of N" footer; assign it page 1 for the TOC.
  addPage('cover');
  const execPage = addPage('exec');
  const scopePage = addPage('scope');
  const priorityPage = priorityFindings.length > 0 ? addPage('priority') : null;
  const allFindingsPage = findingsByCategory.length > 0 ? addPage('all-findings') : null;
  const passedPage = passedModules.length > 0 ? addPage('passed') : null;
  // Compliance page is only added when P5 findings are present (PDF empty-page
  // guard). Old/back-compat scans that have zero P5 findings must not gain a
  // blank compliance page or a TOC entry pointing to one.
  const compliancePage = hasComplianceFindings ? addPage('compliance') : null;
  const nextStepsPage = addPage('next-steps');
  const glossaryPage = addPage('glossary');
  const attestationPage = addPage('attestation');
  const totalPages = pages.length;

  const projectedGrade: Grade =
    scanData.grade === 'F'
      ? 'D'
      : scanData.grade === 'D'
      ? 'C'
      : scanData.grade === 'C'
      ? 'B'
      : scanData.grade === 'B'
      ? 'A'
      : 'A';

  return (
    <div data-print-doc>
      <AutoPrint filename={filename} />

      {/* ─────────────────────────────────────────────────────
          1 — COVER
          ───────────────────────────────────────────────────── */}
      <section className="page page-cover" aria-label="Cover">
        <div className="cover-inner">
          <div className="cover-brand">
            <span className="mark">V</span>
            <span className="name">VibeSafe</span>
            <span className="tag">Security · Performance · Accessibility · SEO</span>
          </div>

          <div className="cover-title">
            <h1>
              Web Quality &amp; Security<br />
              Audit Report
            </h1>
            <p>
              An automated, evidence-based assessment of your site&apos;s
              public-facing security posture, performance budget, accessibility
              compliance, and search-engine readiness.
            </p>
          </div>

          <div className="cover-subject">
            <div>
              <div className="url">{host}</div>
              <div className="url-note">
                Unauthenticated scope · public surface · 1 origin
              </div>
            </div>
            <GradeRing grade={scanData.grade} score={clampedScore} />
          </div>

          <div className="cover-meta-grid">
            <div className="item">
              <div className="label">Report date</div>
              <div className="value">{dateLabel}</div>
            </div>
            <div className="item">
              <div className="label">Scan duration</div>
              <div className="value">{scanData.duration}</div>
            </div>
            <div className="item">
              <div className="label">Findings</div>
              <div className="value">
                {totalFindings} {totalFindings === 1 ? 'issue' : 'issues'} · {passedCount} passed
              </div>
            </div>
            <div className="item">
              <div className="label">Scanner</div>
              <div className="value">VibeSafe {SCANNER_VERSION}</div>
            </div>
          </div>

          <div className="cover-toc">
            <h2>Contents</h2>
            <ol>
              <li>
                <span>Executive summary</span>
                <span className="num">{String(execPage).padStart(2, '0')}</span>
              </li>
              <li>
                <span>Scope &amp; methodology</span>
                <span className="num">{String(scopePage).padStart(2, '0')}</span>
              </li>
              {priorityPage !== null && (
                <li>
                  <span>Priority findings</span>
                  <span className="num">{String(priorityPage).padStart(2, '0')}</span>
                </li>
              )}
              {allFindingsPage !== null && (
                <li>
                  <span>All findings</span>
                  <span className="num">{String(allFindingsPage).padStart(2, '0')}</span>
                </li>
              )}
              {passedPage !== null && (
                <li>
                  <span>What passed</span>
                  <span className="num">{String(passedPage).padStart(2, '0')}</span>
                </li>
              )}
              {compliancePage !== null && (
                <li>
                  <span>Compliance signals</span>
                  <span className="num">{String(compliancePage).padStart(2, '0')}</span>
                </li>
              )}
              <li>
                <span>Recommended next steps</span>
                <span className="num">{String(nextStepsPage).padStart(2, '0')}</span>
              </li>
              <li>
                <span>Glossary &amp; references</span>
                <span className="num">{String(glossaryPage).padStart(2, '0')}</span>
              </li>
              <li>
                <span>Report attestation</span>
                <span className="num">{String(attestationPage).padStart(2, '0')}</span>
              </li>
            </ol>
          </div>

          <div className="cover-footer">
            <div>
              <strong>Prepared for</strong> {preparedFor ?? 'the team'}
            </div>
            <div>
              <strong>Report ID</strong> {reportId}
            </div>
            <div>
              <strong>Confidentiality</strong> Internal use
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────
          2 — EXECUTIVE SUMMARY
          ───────────────────────────────────────────────────── */}
      <section className="page" aria-label="Executive summary">
        <RunningHeader host={host} dateLabel={dateLabel} reportId={reportId} />
        <div className="section">
          <div className="section-head">
            <span className="num">01</span>
            <h2>Executive summary</h2>
            <span className="right">Page {String(execPage).padStart(2, '0')}</span>
          </div>

          <p className="lede">
            {host} earned an overall grade of{' '}
            <strong>
              {scanData.grade} ({clampedScore}/100)
            </strong>
            . {summary.CRITICAL > 0
              ? `${summary.CRITICAL} critical ${summary.CRITICAL === 1 ? 'issue needs' : 'issues need'} immediate attention. `
              : 'No critical issues were found. '}
            {totalFindings - summary.CRITICAL > 0
              ? `${totalFindings - summary.CRITICAL} other finding${totalFindings - summary.CRITICAL === 1 ? '' : 's'} reduce${totalFindings - summary.CRITICAL === 1 ? 's' : ''} defense-in-depth.`
              : 'Remaining findings, if any, are minor.'}
          </p>

          <div className="exec-grid">
            <GradeRing grade={scanData.grade} score={clampedScore} />
            <div className="verdict">
              <h3>{verdict.headline}</h3>
              <p>
                {verdict.body}
                {projectedGrade !== scanData.grade && totalFindings > 0 && (
                  <>
                    {' '}
                    Closing the priority findings would lift this to a projected{' '}
                    <strong>{projectedGrade}</strong>.
                  </>
                )}
              </p>
            </div>
          </div>

          <h3 className="subhead">Findings by severity</h3>
          <div className="severity-row">
            <div className="sev-pill critical">
              <span className="n">{summary.CRITICAL ?? 0}</span>
              <span className="label">Critical</span>
            </div>
            <div className="sev-pill high">
              <span className="n">{summary.HIGH ?? 0}</span>
              <span className="label">High</span>
            </div>
            <div className="sev-pill medium">
              <span className="n">{summary.MEDIUM ?? 0}</span>
              <span className="label">Medium</span>
            </div>
            <div className="sev-pill low">
              <span className="n">{summary.LOW ?? 0}</span>
              <span className="label">Low</span>
            </div>
            <div className="sev-pill passed">
              <span className="n">{passedCount}</span>
              <span className="label">Passed</span>
            </div>
          </div>

          {bandSummary !== null && <BandSummaryCallout items={bandSummary} />}

          {findings.some((f) => f.module === 'P1-06') && (
            <div
              className="callout"
              style={{ marginTop: '4mm', borderLeft: '3px solid #EA580C', background: '#FFF7ED', borderColor: 'rgba(234,88,12,0.35)' }}
            >
              <strong>How to read path-probing findings.</strong>{' '}
              HTTP 200 = file contents were served (CRITICAL — direct data exposure).{' '}
              HTTP 403 = server blocked access but confirmed the path exists (HIGH — return 404 instead for better obscurity).
            </div>
          )}

          <h3 className="subhead" style={{ marginTop: '5mm' }}>Score by category</h3>
          <div className="category-bars">
            <ScoreBar label="🛡️ Security" score={scanData.score} />
            {performanceScore !== null && <ScoreBar label="⚡ Performance" score={performanceScore} />}
            {accessibilityScore !== null && <ScoreBar label="♿ Accessibility" score={accessibilityScore} />}
            {seoScore !== null && <ScoreBar label="🔍 SEO" score={seoScore} />}
          </div>

          <div className="callout">
            <strong>What this report covers and what it doesn&apos;t.</strong> VibeSafe
            tested only what an anonymous visitor can reach: the public,
            unauthenticated surface of {host}. Authenticated routes, admin flows,
            and post-login state weren&apos;t probed. Source code, dependency SBOMs,
            and live exploit verification are out of scope for a passive scan —
            see <em>Recommended next steps</em>.
          </div>
        </div>
        <RunningFooter scanId={scanId} page={execPage} total={totalPages} />
      </section>

      {/* ─────────────────────────────────────────────────────
          3 — SCOPE & METHODOLOGY
          ───────────────────────────────────────────────────── */}
      <section className="page" aria-label="Scope and methodology">
        <RunningHeader host={host} dateLabel={dateLabel} reportId={reportId} />
        <div className="section">
          <div className="section-head">
            <span className="num">02</span>
            <h2>Scope &amp; methodology</h2>
            <span className="right">Page {String(scopePage).padStart(2, '0')}</span>
          </div>

          <p className="lede">
            This scan executed {SCAN_MODULES.length} detection modules across
            security, performance, accessibility, and SEO. Every finding below
            is backed by reproducible evidence captured at scan time.
          </p>

          <div className="kv-grid">
            <div className="kv">
              <span className="k">Target URL</span>
              <span className="v">
                <code>{scanData.url}</code>
              </span>
            </div>
            <div className="kv">
              <span className="k">Detected stack</span>
              <span className="v">{scanData.stack}</span>
            </div>
            <div className="kv">
              <span className="k">Modules run</span>
              <span className="v">{SCAN_MODULES.length} of {SCAN_MODULES.length}</span>
            </div>
            <div className="kv">
              <span className="k">Authentication</span>
              <span className="v">None — anonymous visitor only</span>
            </div>
            <div className="kv">
              <span className="k">Scan duration</span>
              <span className="v">{scanData.duration}</span>
            </div>
            <div className="kv">
              <span className="k">Scanner version</span>
              <span className="v">VibeSafe {SCANNER_VERSION}</span>
            </div>
          </div>

          <h3 className="subhead" style={{ marginTop: '8mm' }}>
            What we tested
          </h3>
          <ul className="columns-2">
            {SCAN_MODULES.map((m) => (
              <li key={m.id}>{m.plainName}</li>
            ))}
          </ul>

          <div className="callout">
            <strong>Reproducibility.</strong> Each finding&apos;s <em>Evidence</em>{' '}
            block contains the raw request/response excerpt that triggered the
            detection. Module IDs (e.g. <code>P1-01</code>) map to the source
            files in <code>src/lib/scanner/modules/</code>.
          </div>
        </div>
        <RunningFooter scanId={scanId} page={scopePage} total={totalPages} />
      </section>

      {/* ─────────────────────────────────────────────────────
          4 — PRIORITY FINDINGS
          ───────────────────────────────────────────────────── */}
      {priorityPage !== null && (
        <section className="page" aria-label="Priority findings">
          <RunningHeader host={host} dateLabel={dateLabel} reportId={reportId} />
          <div className="section">
            <div className="section-head">
              <span className="num">03</span>
              <h2>Priority findings</h2>
              <span className="right">Page {String(priorityPage).padStart(2, '0')}</span>
            </div>

            <p className="lede">
              These {priorityFindings.length} finding
              {priorityFindings.length === 1 ? '' : 's'} move the most points
              on your grade. We recommend fixing them first; the rest can be
              batched with normal maintenance.
            </p>

            {priorityFindings.map((f, i) => (
              <FindingCardPrint key={f.id} finding={f} idx={i + 1} />
            ))}
          </div>
          <RunningFooter scanId={scanId} page={priorityPage} total={totalPages} />
        </section>
      )}

      {/* ─────────────────────────────────────────────────────
          5 — ALL FINDINGS BY CATEGORY
          ───────────────────────────────────────────────────── */}
      {allFindingsPage !== null && (
        <section className="page" aria-label="All findings">
          <RunningHeader host={host} dateLabel={dateLabel} reportId={reportId} />
          <div className="section">
            <div className="section-head">
              <span className="num">04</span>
              <h2>All findings</h2>
              <span className="right">Page {String(allFindingsPage).padStart(2, '0')}+</span>
            </div>

            <p className="lede">
              {totalFindings} {totalFindings === 1 ? 'finding' : 'findings'},
              grouped by category and ordered by severity within each.
            </p>

            {findingsByCategory.map(([category, list]) => (
              <div key={category}>
                <div className="category-label">
                  {category} · {list.length} {list.length === 1 ? 'issue' : 'issues'}
                </div>
                {list.map((f) => {
                  const priorityIdx = priorityFindings.findIndex((p) => p.id === f.id);
                  if (priorityIdx !== -1) {
                    return <FindingBackRef key={f.id} finding={f} idx={priorityIdx + 1} />;
                  }
                  return <FindingCardPrint key={f.id} finding={f} />;
                })}
              </div>
            ))}
          </div>
          <RunningFooter scanId={scanId} page={allFindingsPage} total={totalPages} />
        </section>
      )}

      {/* ─────────────────────────────────────────────────────
          6 — WHAT PASSED
          ───────────────────────────────────────────────────── */}
      {passedPage !== null && (
        <section className="page" aria-label="What passed">
          <RunningHeader host={host} dateLabel={dateLabel} reportId={reportId} />
          <div className="section">
            <div className="section-head">
              <span className="num">05</span>
              <h2>What passed</h2>
              <span className="right">Page {String(passedPage).padStart(2, '0')}</span>
            </div>

            <p className="lede">
              {passedModules.length} {passedModules.length === 1 ? 'check' : 'checks'}{' '}
              passed cleanly. Worth keeping a record so future regressions are
              easy to spot.
            </p>

            <ul className="passed-list">
              {passedModules.map((m) => (
                <li key={m.id}>
                  <div>
                    <strong>{m.plainName}</strong>
                    <span>
                      {m.name} — no issues detected.
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <RunningFooter scanId={scanId} page={passedPage} total={totalPages} />
        </section>
      )}

      {/* ─────────────────────────────────────────────────────
          7 — COMPLIANCE SIGNALS
          Only rendered when P5 findings exist. Scans that pre-date the
          compliance module (or where the feature was off) have zero P5
          findings and must not gain a blank page in the PDF (Low fix).
          ───────────────────────────────────────────────────── */}
      {compliancePage !== null && (
        <section className="page" aria-label="Compliance signals">
          <RunningHeader host={host} dateLabel={dateLabel} reportId={reportId} />
          <div className="section">
            <div className="section-head">
              <span className="num">06</span>
              <h2>Compliance signals</h2>
              <span className="right">Page {String(compliancePage).padStart(2, '0')}</span>
            </div>

            {/* Always-present disclaimer at the top of this section, plus repeated
                inline per framework block below — fulfils the "co-located with EVERY
                framework block" acceptance criterion. */}
            <div
              className="callout"
              role="note"
              style={{ marginBottom: '6mm', borderLeft: '3px solid #D97706', background: '#FFFBEB' }}
            >
              <strong>⚠ {COMPLIANCE_DISCLAIMER_EN}</strong>
            </div>

            {complianceFrameworks.map(({ framework, signals }) => (
              <div key={framework} style={{ marginBottom: '8mm' }}>
                <h3 className="subhead">{framework}</h3>
                {/* Disclaimer co-located with each framework block */}
                <div
                  className="callout"
                  role="note"
                  style={{ marginBottom: '3mm', borderLeft: '3px solid #D97706', background: '#FFFBEB', padding: '4pt 8pt' }}
                >
                  <span style={{ fontSize: '9pt' }}>⚠ {COMPLIANCE_DISCLAIMER_EN}</span>
                </div>
                {signals.length === 0 ? (
                  <p style={{ fontSize: '10.5pt', color: 'var(--pdoc-text-2)' }}>
                    Not evaluated
                  </p>
                ) : (
                  <ul style={{ fontSize: '10.5pt', color: 'var(--pdoc-text-2)' }}>
                    {signals.map((sig, idx) => (
                      <li key={idx}>
                        <strong>
                          {sig.status === 'observed'
                            ? 'Observed'
                            : sig.status === 'not-observed'
                            ? 'Not observed'
                            : 'Not evaluated'}
                        </strong>
                        {' — '}
                        {sig.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          <RunningFooter scanId={scanId} page={compliancePage} total={totalPages} />
        </section>
      )}

      {/* ─────────────────────────────────────────────────────
          8 — NEXT STEPS
          ───────────────────────────────────────────────────── */}
      <section className="page" aria-label="Recommended next steps">
        <RunningHeader host={host} dateLabel={dateLabel} reportId={reportId} />
        <div className="section">
          <div className="section-head">
            <span className="num">07</span>
            <h2>Recommended next steps</h2>
            <span className="right">Page {String(nextStepsPage).padStart(2, '0')}</span>
          </div>

          <p className="lede">
            A pragmatic three-week plan. Each step is reversible and ships
            behind a feature flag where appropriate.
          </p>

          <div className="next-grid">
            <div className="next-card">
              <span className="step">This week</span>
              <h4>Patch the easy wins</h4>
              <p>
                Address the low-effort header and configuration fixes called
                out in the priority section. Typically a single deploy,{' '}
                <strong>+5 to +10 points</strong> on the security score.
              </p>
            </div>
            <div className="next-card">
              <span className="step">Next sprint</span>
              <h4>Roll out defense-in-depth</h4>
              <p>
                Ship a report-only Content Security Policy, raise HSTS to a
                preload-ready max-age, and enable Subresource Integrity for
                third-party scripts.
              </p>
            </div>
            <div className="next-card">
              <span className="step">Within 30 days</span>
              <h4>Run an active DAST scan</h4>
              <p>
                Passive scans can&apos;t verify exploitability. Verify your
                domain and run an active test to probe SQL injection, XSS, and
                API fuzzing on authenticated routes.
              </p>
            </div>
          </div>

          <div className="callout" style={{ marginTop: '6mm' }}>
            <strong>Want to compare this scan to your last one?</strong>{' '}
            Re-scan from your dashboard and select <em>Compare to previous</em>.
            VibeSafe will show which findings opened, closed, or changed
            severity since this report.
          </div>

          <h3 className="subhead" style={{ marginTop: '8mm' }}>
            Out of scope for a passive scan
          </h3>
          <ul style={{ fontSize: '10.5pt', color: 'var(--pdoc-text-2)' }}>
            <li>
              <strong>Authenticated flows.</strong> Broken access control, IDOR,
              privileged endpoints — need a logged-in session to test.
            </li>
            <li>
              <strong>Source-code findings.</strong> Hardcoded secrets in
              private repos, vulnerable dependency versions, SSRF gadgets —
              require code access.
            </li>
            <li>
              <strong>Live exploit probes.</strong> Real SQL injection, XSS
              payloads, API fuzzing — require domain verification and explicit
              consent.
            </li>
          </ul>
        </div>
        <RunningFooter scanId={scanId} page={nextStepsPage} total={totalPages} />
      </section>

      {/* ─────────────────────────────────────────────────────
          8 — GLOSSARY
          ───────────────────────────────────────────────────── */}
      <section className="page" aria-label="Glossary and references">
        <RunningHeader host={host} dateLabel={dateLabel} reportId={reportId} />
        <div className="section">
          <div className="section-head">
            <span className="num">08</span>
            <h2>Glossary &amp; references</h2>
            <span className="right">Page {String(glossaryPage).padStart(2, '0')}</span>
          </div>

          <dl className="glossary">
            <dt>CSP</dt>
            <dd>
              Content Security Policy — an HTTP header that tells the browser
              which sources of scripts, styles, images, and connections are
              allowed. Mitigates XSS impact.
            </dd>

            <dt>HSTS</dt>
            <dd>
              HTTP Strict Transport Security — instructs browsers to refuse
              plaintext HTTP to your origin for a given duration. Preloading
              bakes this into the browser itself.
            </dd>

            <dt>SRI</dt>
            <dd>
              Subresource Integrity — a cryptographic hash on a{' '}
              <code>&lt;script&gt;</code> or <code>&lt;link&gt;</code> tag. The
              browser refuses to execute the resource if the bytes don&apos;t
              match.
            </dd>

            <dt>SameSite</dt>
            <dd>
              A cookie attribute (<code>Strict</code>, <code>Lax</code>,{' '}
              <code>None</code>) controlling whether the cookie is sent on
              cross-site requests. Mitigates CSRF.
            </dd>

            <dt>LCP / INP / CLS</dt>
            <dd>
              Core Web Vitals — Largest Contentful Paint (when the main content
              appears), Interaction to Next Paint (responsiveness), Cumulative
              Layout Shift (visual stability).
            </dd>

            <dt>WCAG 2.2 AA</dt>
            <dd>
              Web Content Accessibility Guidelines, level AA — the legal
              baseline for accessibility in the EU, UK, and most US
              public-sector procurement.
            </dd>

            <dt>DAST</dt>
            <dd>
              Dynamic Application Security Testing — probing a running
              application with real attack payloads, as opposed to static
              analysis of source code.
            </dd>

            <dt>KEV / EPSS</dt>
            <dd>
              CISA&apos;s Known Exploited Vulnerabilities catalog and
              FIRST&apos;s Exploit Prediction Scoring System — used to rank
              CVEs by real-world exploitation rather than CVSS alone.
            </dd>
          </dl>

          <h3 className="subhead" style={{ marginTop: '8mm' }}>
            References
          </h3>
          <ul style={{ fontSize: '10pt', color: 'var(--pdoc-text-2)' }}>
            <li>
              OWASP Secure Headers Project —{' '}
              <a href="https://owasp.org/www-project-secure-headers/">
                owasp.org/www-project-secure-headers
              </a>
            </li>
            <li>
              Mozilla Observatory —{' '}
              <a href="https://observatory.mozilla.org">observatory.mozilla.org</a>
            </li>
            <li>
              Google web.dev — <a href="https://web.dev/vitals">web.dev/vitals</a>
            </li>
            <li>
              W3C WCAG 2.2 —{' '}
              <a href="https://www.w3.org/TR/WCAG22/">w3.org/TR/WCAG22</a>
            </li>
          </ul>
        </div>
        <RunningFooter scanId={scanId} page={glossaryPage} total={totalPages} />
      </section>

      {/* ─────────────────────────────────────────────────────
          9 — ATTESTATION
          ───────────────────────────────────────────────────── */}
      <section className="page" aria-label="Report attestation">
        <RunningHeader host={host} dateLabel={dateLabel} reportId={reportId} />
        <div className="section">
          <div className="section-head">
            <span className="num">09</span>
            <h2>Report attestation</h2>
            <span className="right">Page {String(attestationPage).padStart(2, '0')}</span>
          </div>

          <p className="lede">
            This report was generated automatically by VibeSafe and is not a
            substitute for a manual penetration test. It is designed for
            triage, prioritization, and conversation — not certification.
          </p>

          <div className="kv-grid">
            <div className="kv">
              <span className="k">Report ID</span>
              <span className="v">
                <code>{reportId}</code>
              </span>
            </div>
            <div className="kv">
              <span className="k">Scan ID</span>
              <span className="v">
                <code>{scanId}</code>
              </span>
            </div>
            <div className="kv">
              <span className="k">Issued</span>
              <span className="v">{formatDate(issuedAtIso)}</span>
            </div>
            <div className="kv">
              <span className="k">Valid until</span>
              <span className="v">{formatDate(validUntilIso)} (or next deploy)</span>
            </div>
            <div className="kv">
              <span className="k">Scanner version</span>
              <span className="v">VibeSafe {SCANNER_VERSION}</span>
            </div>
            <div className="kv">
              <span className="k">Prepared for</span>
              <span className="v">{preparedFor ?? 'the team'}</span>
            </div>
          </div>

          <div className="signoff">
            <div>
              <div className="label">Issued by</div>
              <div>VibeSafe Automated Scanner</div>
              <div style={{ color: 'var(--pdoc-text-3)', fontSize: '9.5pt' }}>
                vibesafe.app · contact@vibesafe.app
              </div>
            </div>
            <div>
              <div className="label">Reviewed by</div>
              <div className="line" />
              <div style={{ color: 'var(--pdoc-text-3)', fontSize: '9.5pt' }}>
                Name &amp; date (optional human review)
              </div>
            </div>
          </div>

          <div className="callout" style={{ marginTop: '8mm' }}>
            <strong>How to read this report.</strong> Severity reflects
            exploitability and blast radius, not absolute risk. A high-severity
            finding on a low-traffic marketing page is less urgent than a
            medium on the login flow. Use the <em>Priority findings</em>{' '}
            section as your starting point — it&apos;s already ordered for you.
          </div>

          <p
            style={{
              fontSize: '9pt',
              color: 'var(--pdoc-text-3)',
              marginTop: '10mm',
            }}
          >
            © {new Date(issuedAtIso).getFullYear()} VibeSafe. This report is
            confidential and intended for the named recipient only. Findings
            are based on the public response of {host} at the time of scanning
            and may not reflect the current state of the site.
          </p>
        </div>
        <RunningFooter scanId={scanId} page={attestationPage} total={totalPages} />
      </section>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const tone = gradeBarTone(score);
  return (
    <div className="cat-row">
      <span className="name">{label}</span>
      <span className="track">
        <span className={`fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </span>
      <span className="score">{score} / 100</span>
    </div>
  );
}
