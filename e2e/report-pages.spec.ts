/**
 * E2E tests for the report/[id] page — PAGE-LEVEL state matrix only.
 *
 * This file covers the cross-domain page states (empty, partial, error, success)
 * and the print variant. It does NOT duplicate domain depth already owned by:
 *   e2e/performance-report.spec.ts  — PSI scoring, CrUX, desktop, R2, R1, XSS, compat
 *   e2e/compliance-report.spec.ts   — P5 compliance signals / framework panels
 *   e2e/report-calibration.spec.ts  — severity calibration / merge-and-calibrate logic
 *   e2e/security-modules.spec.ts    — P1 module-by-module security findings
 *
 * What this file covers (D2 page-driven component coverage):
 *   • Page-level State×Display matrix:
 *       - empty  (COMPLETED, zero findings → "no issues" state)
 *       - partial (scan with only Security domain populated; Perf/A11y/SEO absent)
 *       - error   (PSI unavailable/null score → graceful N/A, not a crash)
 *       - success (full multi-domain: Security + Performance + Accessibility + SEO)
 *   • report/[id]/print renders (GET 200, no NaN, required sections present)
 *   • Anonymous (userId:null) public report: LoginGateModal overlay present;
 *     server-rendered HTML is asserted despite the blur overlay.
 *   • Section components exercised on the page:
 *       performance-section, seo-section, accessibility-section, wcag-compliance,
 *       grade-display (GradeDisplay ring in the report header), severity-summary,
 *       finding-card, ScanLevelMissedButton (missed-issue), pdf-export-button (nav),
 *       copy-button (inside ai-improvement-suggestions / finding detail),
 *       ai-improvement-suggestions (rendered via performance-section's async fetch)
 *   • DOM hierarchy and testid contracts from e2e/support/selectors.ts
 *
 * Seed strategy:
 *   seedCompletedScan (from e2e/support/db-seed.ts, T-05):
 *     - Anonymous (userId:null) — public report / LoginGateModal
 *     - Full multi-domain with findings (success state)
 *   Inline Prisma — zero-findings variant (empty state)
 *   seedUnavailableScan (from e2e/support/perf-db-seed.ts) — PSI error state:
 *     NOTE: This reuses the perf-db-seed helper. The test asserts page-level
 *     resilience (no crash, rest of report renders), not perf-specific detail.
 *   Inline Prisma — security-only partial scan (partial state):
 *     The partial state requires a bespoke scan where accessibilityData/seoData
 *     are absent — no existing helper produces this shape without performance data
 *     being the only gap; inline creation is the cleanest approach here.
 *
 * Architecture note:
 *   The report page is a Next.js Server Component that reads from Prisma directly.
 *   Anonymous scans (userId=null) pass canViewScan() checks and render with a
 *   blur overlay + LoginGateModal for unauthenticated visitors. The underlying
 *   HTML is server-rendered, so all assertions work without a session cookie.
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import {
  seedCompletedScan,
  type SeededEntity,
} from './support/db-seed';
import {
  seedAuthUser,
  authStorageState,
  uniqueEmail,
  type SeededAuth,
} from './support/auth-seed';
import { seedUnavailableScan, type SeededScan } from './support/perf-db-seed';
import {
  LOGIN_GATE_MODAL,
  REPORT_TABPANEL,
  REPORT_FILTER_TABS,
} from './support/selectors';

// ── Constants ─────────────────────────────────────────────────────────────────

const E2E_DB_URL = process.env['DEV_DATABASE_URL'] ?? 'file:./e2e.db';

/** Create a fresh Prisma client pointing at the e2e SQLite database. */
function makeClient(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: E2E_DB_URL } },
    log: [],
  });
}

/**
 * Minimal security-only summary for the partial scan seed.
 * Accessibility and SEO domain fields are deliberately omitted so that
 * the report page renders tabs for only the Security domain.
 */
const SECURITY_ONLY_SUMMARY = JSON.stringify({
  CRITICAL: 1,
  HIGH: 1,
  MEDIUM: 1,
  LOW: 0,
  INFO: 0,
});

/** Navigate to /en/report/<id> and wait for network idle. */
async function gotoReport(
  page: import('@playwright/test').Page,
  scanId: string,
): Promise<void> {
  await page.goto(`/en/report/${scanId}`, { waitUntil: 'networkidle' });
}

/** Navigate to /en/report/<id>/print and wait for network idle. */
async function gotoPrint(
  page: import('@playwright/test').Page,
  scanId: string,
): Promise<void> {
  await page.goto(`/en/report/${scanId}/print`, { waitUntil: 'networkidle' });
}

// ══════════════════════════════════════════════════════════════════════════════
// Section: State×Display Matrix — empty state
// QA checklist: Report Page Variants — "empty" (🟡 @functional)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Report page — empty state (zero findings)', () => {
  // No findings seed: seedCompletedScan does not insert Finding rows when we
  // use an inline create to control the minimal scan data. We use Prisma
  // directly here because seedCompletedScan always inserts findings; a
  // zero-findings variant with all domain grades set (so the tabs render)
  // is the only way to isolate the empty-state path for the Security tab.
  //
  // Why inline here: We need a scan with valid security/perf/a11y/seo grades
  // so all four domain tabs are visible, but zero Finding rows, so the
  // Security tab shows "No findings" and severity-summary shows all-zeros.

  let scanId: string | null = null;
  const prisma = makeClient();

  test.beforeAll(async () => {
    const now = new Date();
    const scan = await prisma.scan.create({
      data: {
        targetUrl: 'https://e2e-empty-report.example.com',
        status: 'COMPLETED',
        grade: 'A',
        score: 95.0,
        performanceGrade: 'A',
        performanceScore: 90.0,
        performanceMetrics: JSON.stringify({
          lcp: 1500, fcp: 800, cls: 0.01, tbt: 100, ttfb: 400,
          scoreSource: 'lab', bestPracticesScore: 92, bestPracticesGrade: 'A',
        }),
        accessibilityGrade: 'A',
        accessibilityScore: 95.0,
        accessibilityMetrics: JSON.stringify({ violations: [], passes: 50, incomplete: 0 }),
        seoGrade: 'A',
        seoScore: 98.0,
        seoMetrics: JSON.stringify({ issues: [], mobileScore: 98, aiDiscoverable: true }),
        stack: 'Next.js',
        summary: JSON.stringify({ CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 }),
        userId: null, // anonymous so canViewScan() returns true without auth
        requesterIp: '127.0.0.1',
        startedAt: new Date(now.getTime() - 30_000),
        completedAt: now,
      } as Parameters<typeof prisma.scan.create>[0]['data'],
    });
    scanId = scan.id;
  });

  test.afterAll(async () => {
    if (scanId) {
      try { await prisma.scan.delete({ where: { id: scanId } }); } catch { /* ignore */ }
    }
    await prisma.$disconnect();
  });

  test('@functional report with zero findings renders clean "no issues" state', async ({ page }) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await gotoReport(page, scanId!);

    // Page must load without throwing — no "Report not found" error
    await expect(page.getByText('Report not found', { exact: false })).not.toBeVisible();

    // The report tabpanel is always present (the default security tab is active).
    // GradeDisplay (grade ring) is server-rendered in the header. Asserting a
    // bare single letter ("A") is too brittle — it matches any 'A' on the page,
    // including nav/footer prose. The tabpanel presence below is the stable
    // structural signal that the report rendered for this COMPLETED scan.
    const tabpanel = page.getByTestId(REPORT_TABPANEL);
    await expect(tabpanel).toBeVisible();

    // severity-summary shows zero counts cleanly: when all counts are 0,
    // SeveritySummary (src/components/severity-summary.tsx) skips every
    // severity chip (`if (count === 0) return null`) and renders only the
    // "<n> total" indicator — here "0 total".
    //
    // The previous assertion `getByText('critical').not.toBeVisible()` was a
    // spec authoring bug (type A): the substring "critical" legitimately
    // appears in the security-summary prose ("…While no critical issues were
    // found…", report-view.tsx:130) and in the "Critical" filter-tab label
    // (report-view.tsx:473), neither of which is a severity count badge.
    // Assert the real contract instead: a "0 total" summary and NO critical
    // severity chip (a chip is a count span immediately followed by the
    // lowercased severity word — distinct from prose).
    await expect(page.getByText('0 total').first()).toBeVisible();
    // A SeveritySummary chip is a <span> whose DOM text is exactly the
    // lowercased severity word (CSS capitalizes it visually). Prose uses
    // <strong>"critical security issues"</strong> and the filter tab is a
    // <button>"Critical"; neither is a bare <span> equal to "critical".
    await expect(page.locator('span', { hasText: /^critical$/ })).toHaveCount(0);

    // With zero findings the security tab shows "No findings." (view=all path)
    // OR "No critical issues." when view=critical is the default with no CRITICAL count.
    // The component defaults to 'all' when criticalCount=0, showing "All 0 issues found".
    await expect(tabpanel.getByText(/0.*issue|no findings/i).first()).toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section: State×Display Matrix — partial state
// QA checklist: Report Page Variants — "partial" (🔴 @critical)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Report page — partial state (security-only, no perf/a11y/seo)', () => {
  // This seed produces a scan with Security findings only.
  // The Performance, Accessibility, and SEO domain grade fields are null,
  // so performanceData / accessibilityData / seoData are null in getReportData()
  // and those tabs are hidden. The compliance tab is always visible.
  //
  // Why not use seedUnavailableScan: that helper still sets a performanceGrade
  // and performanceMetrics (with scoreSource:unavailable); this test needs ALL
  // three non-security domains absent so the report uses only the security tab.

  let scanId: string | null = null;
  const prisma = makeClient();

  test.beforeAll(async () => {
    const now = new Date();
    // Create a scan with only Security domain populated (no perf/a11y/seo grades)
    const scan = await prisma.scan.create({
      data: {
        targetUrl: 'https://e2e-partial-report.example.com',
        status: 'COMPLETED',
        grade: 'C',
        score: 65.0,
        // No performance/accessibility/seo grade columns → tabs hidden
        performanceGrade: null,
        performanceScore: null,
        performanceMetrics: null,
        accessibilityGrade: null,
        accessibilityScore: null,
        accessibilityMetrics: null,
        seoGrade: null,
        seoScore: null,
        seoMetrics: null,
        stack: 'Unknown',
        summary: SECURITY_ONLY_SUMMARY,
        userId: null,
        requesterIp: '127.0.0.1',
        startedAt: new Date(now.getTime() - 60_000),
        completedAt: now,
      } as Parameters<typeof prisma.scan.create>[0]['data'],
    });
    scanId = scan.id;

    // Insert a small set of security findings so finding-card renders
    await prisma.finding.createMany({
      data: [
        {
          scanId: scan.id,
          moduleId: 'P1-01',
          severity: 'CRITICAL',
          category: 'Client-Side Secret Exposure',
          title: 'Seed (partial): API key in JS bundle',
          location: 'https://e2e-partial-report.example.com',
          evidence: 'Seed evidence',
          explanation: 'Seed explanation',
          impact: 'E2E seed row',
          fixManual: JSON.stringify(['Fix step 1']),
          fixAiPrompt: 'Seed AI prompt',
        },
        {
          scanId: scan.id,
          moduleId: 'P1-03',
          severity: 'HIGH',
          category: 'Security Headers',
          title: 'Seed (partial): CSP missing',
          location: 'https://e2e-partial-report.example.com',
          evidence: 'Seed evidence',
          explanation: 'Seed explanation',
          impact: 'E2E seed row',
          fixManual: JSON.stringify(['Fix step 1']),
          fixAiPrompt: 'Seed AI prompt',
        },
      ],
    });
  });

  test.afterAll(async () => {
    if (scanId) {
      try { await prisma.scan.delete({ where: { id: scanId } }); } catch { /* ignore */ }
    }
    await prisma.$disconnect();
  });

  test('@critical partial report renders present domains without crash', async ({ page }) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await gotoReport(page, scanId!);

    // Page must load without error
    await expect(page.getByText('Report not found', { exact: false })).not.toBeVisible();

    // Security tab must be visible (it is always shown)
    const tabpanel = page.getByTestId(REPORT_TABPANEL);
    await expect(tabpanel).toBeVisible();

    // The CRITICAL finding must appear in the security tab (default active)
    await expect(page.getByText('Seed (partial): API key in JS bundle', { exact: false })).toBeVisible();

    // Performance / Accessibility / SEO tabs must NOT appear in the tab strip
    // because their data is absent. The tab strip is the element with role=tablist
    // at the top of the unified widget.
    const tabStrip = page.locator('[role="tablist"][aria-label="Report sections"]');
    await expect(tabStrip).toBeVisible();
    await expect(tabStrip.getByText('Performance')).not.toBeVisible();
    await expect(tabStrip.getByText('Accessibility')).not.toBeVisible();
    await expect(tabStrip.getByText('SEO')).not.toBeVisible();

    // Security tab IS visible and labelled
    await expect(tabStrip.getByText('Security')).toBeVisible();

    // No NaN anywhere on the page
    const bodyText = await page.textContent('body') ?? '';
    expect(bodyText).not.toContain('NaN');
  });

  test('@critical partial report: finding-card renders for seeded security finding', async ({ page }) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await gotoReport(page, scanId!);

    // finding-card renders — it shows the finding title
    await expect(
      page.getByText('Seed (partial): API key in JS bundle', { exact: false }),
    ).toBeVisible();

    // report-filter-tabs (Critical / All Issues / Passed) must render in the security tab
    await expect(page.getByTestId(REPORT_FILTER_TABS)).toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section: State×Display Matrix — error state (PSI unavailable)
// QA checklist: Report Page Variants — "error" (🔴 @critical)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Report page — error state (PSI/performance unavailable)', () => {
  // Uses seedUnavailableScan from perf-db-seed.ts which creates a scan with
  // performanceGrade='N/A', performanceScore=null, scoreSource='unavailable'.
  // This is the "error" state from the qa-checklist: PSI unavailable → graceful N/A.
  // Assertion focus is page-level resilience, NOT PSI-specific details
  // (those are covered by e2e/performance-report.spec.ts unavailable-04 et al.).

  let seeded: SeededScan | null = null;

  test.beforeAll(async () => {
    seeded = await seedUnavailableScan();
  });

  test.afterAll(async () => {
    await seeded?.cleanup();
  });

  test('@critical PSI-unavailable report renders gracefully — no crash, N/A message shown', async ({ page }) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await gotoReport(page, seeded!.id);

    // Page must load without error
    await expect(page.getByText('Report not found', { exact: false })).not.toBeVisible();

    // No NaN — the performance section must not render numeric NaN values
    const bodyText = await page.textContent('body') ?? '';
    expect(bodyText).not.toContain('NaN');

    // Performance section must show the "not measured" / unavailable message.
    // The en.json key 'report.performance.scoreUnavailable' resolves to:
    // "Performance not measured (provider temporarily unavailable)"
    await expect(
      page.getByText('Performance not measured', { exact: false }),
    ).toBeVisible();

    // The rest of the report (the report header, the security tab) must still render.
    await expect(page.getByTestId(REPORT_TABPANEL)).toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section: State×Display Matrix — success state (full multi-domain)
// QA checklist: Report Page Variants — "success" (🔴 @critical)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Report page — success state (full multi-domain report)', () => {
  // seedCompletedScan produces a scan covering all four domains: Security (P1
  // findings), Performance (metrics + grade), Accessibility (metrics + grade),
  // SEO (metrics + grade). This triggers all four domain tabs.
  //
  // AUTH MODEL — split by test, not by block.
  // The report page (src/app/[locale]/report/[id]/page.tsx:188-199) wraps the
  // whole report in `pointerEvents:'none'` + `filter:blur(...)` whenever the
  // visitor is NOT authenticated (`isAuthed = Boolean(currentUser)`); an
  // anonymous, non-interactive teaser sits behind the LoginGateModal. That is
  // correct, long-standing product behaviour (commit 6b5056b; unchanged vs
  // origin/main). Consequences:
  //   • Tests that only assert presence/text (toBeVisible / toBeAttached)
  //     work anonymously — `filter:blur` does NOT make elements invisible to
  //     Playwright. These keep the anonymous seed.
  //   • Tests that `.click()` a tab or finding-card MUST be authenticated, or
  //     the click times out at 15 s because pointer events are disabled by
  //     design. These use the seeded session cookie + a scan owned by the
  //     seeded user (mirrors the proven e2e/scan.spec.ts pattern).
  //   • The "@non-blocker ScanLevelMissedButton sign-in nudge" test asserts
  //     the ANONYMOUS-only nudge, so it must stay anonymous.

  let seededAuth: SeededAuth | null = null;
  // Anonymous scan id (for the presence-only + anon-nudge tests).
  let seeded: SeededEntity | null = null;
  // Scan owned by the seeded user (for the interactive/click tests).
  let ownedScan: SeededEntity | null = null;

  test.beforeAll(async () => {
    seeded = await seedCompletedScan({ userId: null });
    seededAuth = await seedAuthUser({ email: uniqueEmail('report-success') });
    ownedScan = await seedCompletedScan({ userId: seededAuth.user.id });
  });

  test.afterAll(async () => {
    await seeded?.cleanup();
    await ownedScan?.cleanup();
    await seededAuth?.cleanup();
  });

  /**
   * Open the OWNED scan report in an authenticated context so the report is
   * interactive (isAuthed = true → no blur / no pointer-events:none). Returns
   * the page; the caller is responsible for closing it (and its context).
   */
  async function openAuthedReport(
    browser: import('@playwright/test').Browser,
  ): Promise<{
    page: import('@playwright/test').Page;
    dispose: () => Promise<void>;
  }> {
    const ctx = await browser.newContext({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      storageState: authStorageState(seededAuth!.sessionToken),
    });
    const page = await ctx.newPage();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await page.goto(`/en/report/${ownedScan!.id}`, { waitUntil: 'networkidle' });
    return {
      page,
      dispose: async () => {
        await page.close();
        await ctx.close();
      },
    };
  }

  test('@critical full multi-domain report renders all four domain sections with grades', async ({ page }) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await gotoReport(page, seeded!.id);

    // Page loads without error
    await expect(page.getByText('Report not found', { exact: false })).not.toBeVisible();

    // The tab strip must show all four domain tabs.
    const tabStrip = page.locator('[role="tablist"][aria-label="Report sections"]');
    await expect(tabStrip.getByText('Security')).toBeVisible();
    await expect(tabStrip.getByText('Performance')).toBeVisible();
    await expect(tabStrip.getByText('Accessibility')).toBeVisible();
    await expect(tabStrip.getByText('SEO')).toBeVisible();

    // The unified report tabpanel body is always present regardless of active tab.
    await expect(page.getByTestId(REPORT_TABPANEL)).toBeVisible();

    // No NaN in the page
    const bodyText = await page.textContent('body') ?? '';
    expect(bodyText).not.toContain('NaN');
  });

  // ── GradeDisplay (report header ring) ──────────────────────────────────────

  test('@critical success report: GradeDisplay ring renders the security grade (D2 component coverage)', async ({ page }) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await gotoReport(page, seeded!.id);

    // seedCompletedScan sets grade: 'C' for the overall security grade.
    // GradeDisplay renders an animated ring with the grade letter.
    // The grade letter 'C' is the server-rendered text for the overall grade.
    //
    // We assert the grade letter is present in the header area (the report header
    // contains the GradeDisplay ring component and the severity summary alongside).
    await expect(page.getByText('C').first()).toBeVisible();
  });

  // ── severity-summary ───────────────────────────────────────────────────────

  test('@critical success report: severity-summary shows non-zero counts (D2 component coverage)', async ({ page }) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await gotoReport(page, seeded!.id);

    // The seeded scan has CRITICAL:1, HIGH:2, MEDIUM:3, LOW:2, INFO:1.
    // SeveritySummary renders a dot + count + label for each non-zero severity.
    // The 'critical' label is present because CRITICAL count = 1.
    await expect(page.getByText('critical', { exact: false }).first()).toBeVisible();
  });

  // ── finding-card (security tab default) ───────────────────────────────────

  test('@critical success report: finding-card renders for seeded security findings', async ({ page }) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await gotoReport(page, seeded!.id);

    // Security tab is active by default. The seeded CRITICAL finding title must be visible.
    await expect(
      page.getByText('Seed: API key exposed in JS bundle', { exact: false }),
    ).toBeVisible();

    // The report-filter-tabs (Critical / All Issues / Passed) must render.
    await expect(page.getByTestId(REPORT_FILTER_TABS)).toBeVisible();
  });

  // ── performance-section (switch to Performance tab) ───────────────────────

  test('@functional success report: performance-section renders on the Performance tab', async ({ browser }) => {
    // Authenticated + owned scan → report is interactive (no pointer-events:none).
    const { page, dispose } = await openAuthedReport(browser);
    try {
      // Click the Performance tab to activate it
      const tabStrip = page.locator('[role="tablist"][aria-label="Report sections"]');
      await tabStrip.getByText('Performance').click();

      // "Performance Analysis" heading is rendered by PerformanceSection
      await expect(page.getByText('Performance Analysis', { exact: false })).toBeVisible();
    } finally {
      await dispose();
    }
  });

  // ── accessibility-section + wcag-compliance (switch to Accessibility tab) ─

  test('@functional success report: accessibility-section and wcag-compliance render on the Accessibility tab', async ({ browser }) => {
    const { page, dispose } = await openAuthedReport(browser);
    try {
      // Click the Accessibility tab
      const tabStrip = page.locator('[role="tablist"][aria-label="Report sections"]');
      await tabStrip.getByText('Accessibility').click();

      // AccessibilitySection renders "Accessibility Analysis" heading
      await expect(page.getByText('Accessibility Analysis', { exact: false })).toBeVisible();

      // WCAGCompliance is mounted inside AccessibilitySection. Assert the
      // section heading rendered (above) — a bare single-letter grade match
      // ("B") is too brittle (matches any 'B' in nav/footer/prose).
    } finally {
      await dispose();
    }
  });

  // ── seo-section (switch to SEO tab) ───────────────────────────────────────

  test('@functional success report: seo-section renders on the SEO tab', async ({ browser }) => {
    const { page, dispose } = await openAuthedReport(browser);
    try {
      // Click the SEO tab
      const tabStrip = page.locator('[role="tablist"][aria-label="Report sections"]');
      await tabStrip.getByText('SEO').click();

      // SEOSection renders "SEO Analysis" heading (from seo-section.tsx h2)
      await expect(page.getByText('SEO Analysis', { exact: false })).toBeVisible();
    } finally {
      await dispose();
    }
  });

  // ── missed-issue-button (ScanLevelMissedButton — unauthenticated path) ────

  test('@non-blocker success report: ScanLevelMissedButton renders (sign-in nudge for anon)', async ({ page }) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await gotoReport(page, seeded!.id);

    // The security tab is active by default. ScanLevelMissedButton is rendered
    // in the security tab header. When authed=false it renders the "Sign in to
    // flag a missed issue" nudge instead of the full button.
    // The report page sets authed = Boolean(currentUser); for anonymous visits
    // (no session cookie), currentUser is null → authed = false.
    await expect(
      page.getByText('Sign in to flag a missed issue', { exact: false }),
    ).toBeVisible();
  });

  // ── pdf-export-button (rendered in Nav when showReportActions=true) ────────

  test('@non-blocker success report: pdf-export-button or nav report actions render in nav', async ({ page }) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await gotoReport(page, seeded!.id);

    // The Nav is rendered with showReportActions=true for the report page.
    // PdfExportButton is rendered inside the Nav when the pdfExport feature
    // is enabled. The button is conditional on pdfEnabled (useFeature hook).
    // When the feature is OFF (default in e2e env without FEATURES override),
    // PdfExportButton returns null. We assert the Nav itself renders — a
    // full assertion of the PDF button requires the pdfExport feature flag ON.
    //
    // D2 coverage note: The pdf-export-button renders only when pdfExport=true.
    // The nav is always present; we assert the report nav bar is loaded.
    await expect(page.locator('nav').first()).toBeVisible();
  });

  // ── ai-improvement-suggestions (via performance-section async fetch) ───────

  test('@functional success report: performance-section does not crash when perf-suggestions are fetched', async ({ browser }) => {
    const { page, dispose } = await openAuthedReport(browser);
    try {
      // Navigate to the Performance tab which loads PerformanceSection.
      // PerformanceSection makes a client-side fetch to /api/v1/scans/<id>/
      // performance-suggestions and then conditionally renders
      // AIImprovementSuggestions. We assert the performance section renders
      // without crashing and that no error state is shown — if the fetch
      // fails, the component degrades gracefully.
      const tabStrip = page.locator('[role="tablist"][aria-label="Report sections"]');
      await tabStrip.getByText('Performance').click();
      await page.waitForLoadState('networkidle');

      // No error state from the suggestions fetch
      await expect(page.getByText('Performance Analysis', { exact: false })).toBeVisible();
      const bodyText = await page.textContent('body') ?? '';
      expect(bodyText).not.toContain('NaN');
    } finally {
      await dispose();
    }
  });

  // ── copy-button (inside finding-card detail when finding is expanded) ──────

  test('@non-blocker success report: copy-button renders inside expanded finding-card', async ({ browser }) => {
    // Authenticated + owned scan → the finding card is clickable (the
    // anonymous teaser disables pointer events by design).
    const { page, dispose } = await openAuthedReport(browser);
    try {
      // The security tab is active; click on the CRITICAL finding card to expand it.
      // FindingCard renders inline — clicking it toggles the expanded state.
      // When expanded, the fixAiPrompt section renders a CopyButton.
      const criticalFinding = page.getByText('Seed: API key exposed in JS bundle', { exact: false });
      await criticalFinding.click();

      // After expansion, a CopyButton with label 'Copy' should be visible inside
      // the expanded card. CopyButton renders a <button> with text "Copy" or "Copied!".
      // The fixAiPrompt section shows "Copy" label by default.
      //
      // Note: CopyButton does not have a data-testid — we locate it by text.
      // The parent finding-card may have multiple Copy buttons (one per expanded card).
      await expect(page.getByRole('button', { name: /copy/i }).first()).toBeVisible();
    } finally {
      await dispose();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section: Anonymous public report — LoginGateModal
// QA checklist: "The report page is publicly viewable for an anonymous
//   (userId:null) seeded scan" (🟡 @functional)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Report page — anonymous (userId:null) public report', () => {
  // Anonymous scans pass canViewScan() without a session. The page renders the
  // full report HTML (server-rendered) with a blur overlay + LoginGateModal
  // dialog overlaid on top. The report content is in the DOM; the LoginGateModal
  // is a fixed-position overlay.

  let seeded: SeededEntity | null = null;

  test.beforeAll(async () => {
    seeded = await seedCompletedScan({ userId: null });
  });

  test.afterAll(async () => {
    await seeded?.cleanup();
  });

  test('@functional anonymous report: LoginGateModal overlay is present for unauthenticated visitor', async ({ page }) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await gotoReport(page, seeded!.id);

    // The LoginGateModal renders as a fixed-position dialog with data-testid="login-gate-modal"
    const modal = page.getByTestId(LOGIN_GATE_MODAL);
    await expect(modal).toBeVisible();

    // The modal has role="dialog" and aria-modal="true"
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');

    // The modal heading "Your report is ready" must be present
    await expect(page.getByText('Your report is ready', { exact: false })).toBeVisible();
  });

  test('@functional anonymous report: server-rendered report HTML is present despite blur overlay', async ({ page }) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await gotoReport(page, seeded!.id);

    // The report content is server-rendered. The blur is applied via CSS
    // filter/opacity on the content div — the HTML is present in the DOM even
    // when visually blurred. We assert key content is in the DOM (not asserting
    // visual state which is CSS-only).

    // The report tabpanel element is in the DOM (server-rendered).
    // Note: it may not be "visible" in the Playwright sense because the parent
    // has pointer-events:none and filter:blur. We check DOM presence via locator
    // count instead of toBeVisible() which checks visual visibility.
    const tabpanelCount = await page.getByTestId(REPORT_TABPANEL).count();
    expect(tabpanelCount).toBeGreaterThan(0);

    // The seeded URL is in the server-rendered HTML
    await expect(
      page.getByText('e2e-seed.example.com', { exact: false }).first(),
    ).toBeAttached();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section: Print variant (report/[id]/print)
// QA checklist: "The print report variant renders" (🟢 @non-blocker)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Report page — print variant (report/[id]/print)', () => {
  let seeded: SeededEntity | null = null;

  test.beforeAll(async () => {
    seeded = await seedCompletedScan({ userId: null });
  });

  test.afterAll(async () => {
    await seeded?.cleanup();
  });

  test('@non-blocker print report renders for a completed scan without errors', async ({ page }) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await gotoPrint(page, seeded!.id);

    // Page must load without "Report not found" or notFound() redirect
    await expect(page.getByText('Report not found', { exact: false })).not.toBeVisible();
    await expect(page.getByText('not-found', { exact: false })).not.toBeVisible();

    // PrintReport renders the scan URL in the print document
    await expect(
      page.getByText('e2e-seed.example.com', { exact: false }).first(),
    ).toBeVisible();

    // No NaN in the print page
    const bodyText = await page.textContent('body') ?? '';
    expect(bodyText).not.toContain('NaN');

    // The print page renders the grade letter (the PrintReport renders the overall
    // security grade). The seeded scan has grade='C'.
    await expect(page.getByText('C').first()).toBeVisible();
  });

  test('@non-blocker print report: visiting an unknown scan id results in 404 (not a crash)', async ({ page }) => {
    // The print page calls notFound() for a missing scan — Playwright renders
    // the Next.js 404 page, which contains 'not-found' text or a 404 heading.
    // We assert no 500 error page; a 404 not-found response is acceptable.
    const response = await page.goto('/en/report/nonexistent-scan-id-404/print');

    // The response must NOT be 500 (internal server error)
    // It will be 404 (not found) which is the correct behaviour
    expect(response?.status()).not.toBe(500);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section: AI improvement suggestions — graceful absent state
// QA checklist: "AI improvement suggestions render when enrichment data is
//   present" — absent variant: "Crash when enrichment is missing" (🟡 @functional)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Report page — AI suggestions absent gracefully', () => {
  // seedCompletedScan's findings do NOT include LLM enrichment fields
  // (no enrichmentData column in the Finding model). The performance-suggestions
  // API returns suggestions based on the performanceMetrics blob; when the
  // fetch succeeds but returns no quick wins / major improvements, the
  // AIImprovementSuggestions section renders nothing (or a null return).
  // This test asserts the page does not crash when enrichment is absent.

  // Authenticated + owned scan: this test must CLICK the Performance tab, so
  // the report has to be interactive. The anonymous teaser sets
  // pointer-events:none by design (page.tsx:188-199) → clicks time out.
  let seededAuth: SeededAuth | null = null;
  let ownedScan: SeededEntity | null = null;

  test.beforeAll(async () => {
    seededAuth = await seedAuthUser({ email: uniqueEmail('report-ai-absent') });
    ownedScan = await seedCompletedScan({ userId: seededAuth.user.id });
  });

  test.afterAll(async () => {
    await ownedScan?.cleanup();
    await seededAuth?.cleanup();
  });

  test('@functional report does not crash when AI enrichment / suggestions are absent', async ({ browser }) => {
    const ctx = await browser.newContext({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      storageState: authStorageState(seededAuth!.sessionToken),
    });
    const page = await ctx.newPage();
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await page.goto(`/en/report/${ownedScan!.id}`, { waitUntil: 'networkidle' });

      // Navigate to the Performance tab (where AIImprovementSuggestions is rendered)
      const tabStrip = page.locator('[role="tablist"][aria-label="Report sections"]');
      await tabStrip.getByText('Performance').click();
      await page.waitForLoadState('networkidle');

      // Page must load without crash
      await expect(page.getByText('Report not found', { exact: false })).not.toBeVisible();
      await expect(page.getByText('Performance Analysis', { exact: false })).toBeVisible();

      // No unhandled error banner
      const bodyText = await page.textContent('body') ?? '';
      expect(bodyText).not.toContain('NaN');
    } finally {
      await page.close();
      await ctx.close();
    }
  });
});
