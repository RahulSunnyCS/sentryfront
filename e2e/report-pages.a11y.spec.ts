/**
 * Accessibility E2E tests for the report/[id] page — axe-core WCAG A+AA.
 *
 * Runs axe on the full multi-domain report view (success state) after the page
 * reaches a stable, post-seed state. All four domain tabs have been seeded so
 * all tab buttons are rendered in the DOM before axe runs.
 *
 * Alignment with qa-checklist.md R3 (accepted recommendation):
 *   "The report page has no axe-core WCAG A/AA violations in its stable
 *    full-report state (R3)"
 *   Scenario: Seed a COMPLETED scan with Security, Performance, Accessibility,
 *             and SEO findings/grades. Visit /en/report/<id>, wait networkidle
 *             + all four domain sections rendered (stable asserted state).
 *             Run axe-core scoped to the page main region, ruleset WCAG 2.0/2.1 A+AA.
 *   Automatable: yes
 *   Tag: @functional
 *
 * Scope: main region only (not the fixed LoginGateModal overlay). The modal is
 * a client-side-only element that appears over the blurred content for anonymous
 * visitors. We use an authenticated-like seed flow: the scan is anonymous
 * (userId=null) so it renders without a session cookie, but we scope axe to
 * the page main region to avoid false positives from the modal's role="dialog"
 * being stacked under a backdrop (which technically passes WCAG but can produce
 * axe aria-hidden-focus false positives in some configurations).
 *
 * Allow-list (pre-existing colour-contrast violations tolerated in the codebase):
 *   none documented yet — any new violation blocks this test until the allow-list
 *   is updated here with a concrete per-rule rationale.
 *
 * Stable-state assertion: We wait for networkidle + all four tab labels visible
 * in the tab strip before running axe. Running axe before the tab strip has
 * hydrated would miss interactive ARIA violations.
 *
 * This file is intentionally minimal — it covers the single R3 axe case for
 * the report page. Extend VIOLATION_ALLOW_LIST below when a pre-existing
 * cosmetic violation is triaged and accepted; never silently add rules without
 * a documented rationale.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedCompletedScan, type SeededEntity } from './support/db-seed';

// ── Allow-list ─────────────────────────────────────────────────────────────────
//
// Pre-existing WCAG A/AA violations that are known, documented, and accepted by
// the team. Any allow-list entry must include:
//   - The axe rule ID (e.g. 'color-contrast')
//   - A human rationale for why it is accepted
//   - A tracking reference (issue # or date of triage)
//
// Format: an array of axe rule IDs whose violations are excluded from the
// failure assertion. Violations are still LOGGED in the test output so engineers
// can monitor whether they grow in count.
//
// Current: empty — no pre-existing violations accepted yet. Any violation found
// by this test must be fixed before Gate 2 unless explicitly added here.
const VIOLATION_ALLOW_LIST: string[] = [
  // Example entry format (do not uncomment without triage):
  // 'color-contrast',  // Pre-existing Tailwind base color on secondary text;
  //                    // tracked in GitHub issue #NNN; cosmetic, not functional.
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Navigate to /en/report/<id> and wait for the stable state:
 *   networkidle AND all four domain tab labels visible in the tab strip.
 *
 * We assert on the tab strip visibility rather than a fixed timeout so the
 * axe run happens after React hydration (the tab strip buttons are client-side
 * components; their aria-selected state is only correct post-hydration).
 */
async function gotoReportStable(
  page: import('@playwright/test').Page,
  scanId: string,
): Promise<void> {
  await page.goto(`/en/report/${scanId}`, { waitUntil: 'networkidle' });

  // Stable-state assertion: all four domain tabs must be visible in the tab
  // strip before axe runs. This guards against running axe on a partially
  // hydrated page where ARIA states may still be default (all aria-selected=false).
  const tabStrip = page.locator('[role="tablist"][aria-label="Report sections"]');
  await expect(tabStrip).toBeVisible();
  await expect(tabStrip.getByText('Security')).toBeVisible();
  await expect(tabStrip.getByText('Performance')).toBeVisible();
  await expect(tabStrip.getByText('Accessibility')).toBeVisible();
  await expect(tabStrip.getByText('SEO')).toBeVisible();
}

// ══════════════════════════════════════════════════════════════════════════════
// R3 — Accessibility axe scan: report page success state
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Report page axe accessibility (R3)', () => {
  let seeded: SeededEntity | null = null;

  test.beforeAll(async () => {
    // Seed a full multi-domain completed scan (anonymous, no auth required).
    // seedCompletedScan inserts Security, Performance, Accessibility, and SEO
    // findings + grade columns so all four domain tabs render in the tab strip.
    seeded = await seedCompletedScan({
      userId: null, // anonymous: canViewScan() passes without a session cookie
      includeCompliance: false, // compliance tab always renders; no extra findings needed
    });
  });

  test.afterAll(async () => {
    await seeded?.cleanup();
  });

  test('@functional report page has no WCAG A/AA axe violations in its stable full-report state', async ({
    page,
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await gotoReportStable(page, seeded!.id);

    // Run axe scoped to the <main> element (or the body if <main> is absent).
    // Scoping to <main> excludes the fixed-position LoginGateModal overlay,
    // which is role="dialog" with aria-modal="true" and would otherwise produce
    // aria-hidden-focus false positives in some axe rule configurations.
    //
    // The report page does not render a <main> element in its current markup;
    // it uses a <div style={{minHeight:'100vh'}}> root. We therefore scope to
    // the document body and rely on the result filtering below. If a <main>
    // landmark is added in future, update this selector.
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Exclude the fixed LoginGateModal overlay from analysis.
      // The modal uses a dark backdrop (rgba 0,0,0,0.60) that can trigger
      // colour-contrast violations against elements it visually obscures but
      // does not hide from the accessibility tree. Excluding its container by
      // data-testid avoids spurious violations from the overlay backdrop.
      .exclude('[data-testid="login-gate-modal"]')
      .analyze();

    // Partition results: violations on the allow-list are logged but not failed;
    // violations NOT on the allow-list cause the test to fail.
    const allowedViolations = axeResults.violations.filter((v) =>
      VIOLATION_ALLOW_LIST.includes(v.id),
    );
    const blockingViolations = axeResults.violations.filter(
      (v) => !VIOLATION_ALLOW_LIST.includes(v.id),
    );

    // Log allow-listed violations so engineers can monitor whether they grow.
    if (allowedViolations.length > 0) {
      console.warn(
        `[a11y allow-list] ${allowedViolations.length} pre-accepted violation(s) found on report page:`,
        allowedViolations.map((v) => ({
          rule: v.id,
          impact: v.impact,
          nodeCount: v.nodes.length,
          description: v.description,
        })),
      );
    }

    // Build a human-readable failure summary so engineers can triage without
    // re-running the suite locally.
    const violationSummary = blockingViolations
      .map((v) => {
        const nodeInfo = v.nodes
          .slice(0, 3) // cap at 3 nodes to keep output readable
          .map((n) => n.target.join(', '))
          .join(' | ');
        return `[${v.impact ?? 'unknown'}] ${v.id}: ${v.description} — nodes: ${nodeInfo}`;
      })
      .join('\n');

    expect(
      blockingViolations,
      `Found ${blockingViolations.length} WCAG A/AA axe violation(s) not on the allow-list:\n${violationSummary}\n\n` +
        `If these are pre-existing cosmetic violations, add the rule ID to VIOLATION_ALLOW_LIST ` +
        `in e2e/report-pages.a11y.spec.ts with a documented rationale.`,
    ).toHaveLength(0);
  });
});
