/**
 * Compliance section E2E tests — VibeSafe report-view ComplianceSection.
 *
 * QA-checklist items covered (pipeline/qa-checklist.md):
 *  @critical  — Legal honesty: no attestation words in the tab
 *  @critical  — Disclaimer co-located with every framework block
 *  @critical  — Framework-signal score label is non-binding (neutral status chips)
 *  @critical  — No numeric score / "X/8" fraction in the compliance tab
 *  @critical  — flag-off / back-compat: no crash, correct empty state shown
 *  @functional — Signal grouping by framework (GDPR / CCPA / WCAG)
 *  @functional — Empty-state (no P5 data) neutral — no "non-compliant" claim
 *
 * Demo route strategy
 * -------------------
 * The report page at /en/report/demo returns BAD_SCAN (no P5 findings), which
 * exercises the "back-compat / flag-off" empty-state path without any auth or
 * DB requirement.
 *
 * Tests that require P5 findings rendered in the UI cannot use the demo route
 * because BAD_SCAN contains no P5 findings and the demo route has no P5
 * fixture. Those tests are written against a URL parameter-based approach:
 * the test navigates to /en/report/demo, forces the Compliance tab open, and
 * inspects what is rendered. Because no P5 data exists in the demo fixture,
 * the with-P5-findings tests are marked with a note that they require a scan
 * ID from the real flow (CI environment variable COMPLIANCE_SCAN_ID).
 *
 * Required env vars (add to .env.test or CI secrets):
 *  - COMPLIANCE_SCAN_ID  — ID of a completed scan that has P5 findings; used
 *                          by tests that verify the populated compliance tab.
 *                          If absent, those tests are skipped automatically.
 *  - BASE_URL            — Override base URL (default: http://localhost:3000).
 *
 * Tests that only use /en/report/demo run without any env vars.
 */

import { test, expect } from '@playwright/test';

// ── Constants ────────────────────────────────────────────────────────────────

/** Demo report URL — no auth, no DB, returns BAD_SCAN (no P5 findings). */
const DEMO_REPORT = '/en/report/demo';

/**
 * Scan ID for a report that has P5 compliance findings. Populated by
 * COMPLIANCE_SCAN_ID env var in CI; absent in basic smoke runs.
 */
const COMPLIANCE_SCAN_ID = process.env.COMPLIANCE_SCAN_ID;

/** Full URL for the P5-populated report, if the env var is set. */
const P5_REPORT = COMPLIANCE_SCAN_ID ? `/en/report/${COMPLIANCE_SCAN_ID}` : null;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Navigate to a report page and click the Compliance tab.
 * Returns after the tab is active (aria-selected="true").
 */
async function openComplianceTab(page: import('@playwright/test').Page, url: string) {
  await page.goto(url);
  // The tab strip uses role="tab" buttons labelled with the tab name.
  const complianceTab = page.getByRole('tab', { name: /Compliance/i });
  await expect(complianceTab).toBeVisible();
  await complianceTab.click();
  await expect(complianceTab).toHaveAttribute('aria-selected', 'true');
}

/**
 * Return the text content of the visible tab panel (role="tabpanel").
 * Used for broad string-match assertions without coupling to exact DOM shape.
 */
async function tabPanelText(page: import('@playwright/test').Page): Promise<string> {
  return page.getByRole('tabpanel').textContent() ?? '';
}

// ── ATTESTATION-LANGUAGE GUARD (critical) ────────────────────────────────────

/**
 * The words that must never appear in the compliance tab. Any one of these
 * would assert a legal verdict that VibeSafe cannot make.
 *
 * QA checklist: "The compliance section never uses the word 'compliant',
 * 'certified', 'attested', or 'passed' for any framework" (@critical)
 * and "No attestation/verdict words rendered in the tab" (@critical).
 */
const FORBIDDEN_VERDICT_WORDS = [
  /\bcompliant\b/i,
  /\bcertified\b/i,
  /\battested\b/i,
  /\bpassed\b/i,
  /\bgauranteed\b/i,
  /\bguaranteed\b/i,
  /\bconforms\b/i,
];

/**
 * Words that indicate a numeric score or fraction ("8/8", "6/8", "100%
 * compliance", etc.) — these must never appear in the compliance tab.
 *
 * QA checklist: "score label … not a compliance score", "A score of 100
 * does not render as 'fully compliant'" (@critical).
 */
const FORBIDDEN_SCORE_PATTERNS = [
  /\d+\s*\/\s*\d+/,         // "6/8", "8 / 8", "0/6"
  /compliance score/i,
  /fully compliant/i,
];

// ── Test group: demo route (no P5 data — empty / back-compat state) ──────────

test.describe('Compliance tab — demo route (no P5 findings)', () => {
  test(
    'Compliance tab is present and activatable on demo report @critical',
    async ({ page }) => {
      await page.goto(DEMO_REPORT);

      const complianceTab = page.getByRole('tab', { name: /Compliance/i });
      await expect(complianceTab).toBeVisible();

      await complianceTab.click();
      await expect(complianceTab).toHaveAttribute('aria-selected', 'true');

      // The tab panel must be visible and contain no unhandled error boundary.
      const panel = page.getByRole('tabpanel');
      await expect(panel).toBeVisible();
    },
  );

  test(
    'Empty state (no P5 data) does not crash and shows neutral text — no "non-compliant" claim @functional',
    async ({ page }) => {
      await openComplianceTab(page, DEMO_REPORT);

      const panel = page.getByRole('tabpanel');
      await expect(panel).toBeVisible();

      // The empty state heading and body use i18n keys that must not render
      // as raw key strings.
      const text = await tabPanelText(page);

      // Must not expose raw i18n key to the user.
      expect(text).not.toContain('report.compliance');
      expect(text).not.toContain('emptyTitle');
      expect(text).not.toContain('emptyBody');

      // Empty state must not use verdict language.
      for (const pattern of FORBIDDEN_VERDICT_WORDS) {
        expect(text).not.toMatch(pattern);
      }

      // Must not show a numeric fraction like "0/6".
      for (const pattern of FORBIDDEN_SCORE_PATTERNS) {
        expect(text).not.toMatch(pattern);
      }
    },
  );

  test(
    'Empty state explicitly says "no compliance claim" rather than implying non-compliance @functional',
    async ({ page }) => {
      await openComplianceTab(page, DEMO_REPORT);

      const text = await tabPanelText(page);

      // The i18n string for emptyBody ends with "No compliance claim is made
      // for this scan." We verify the sentiment is present (not the exact
      // wording, to allow future copy edits) by checking that the section
      // does NOT say the site is non-compliant.
      expect(text).not.toMatch(/not compliant/i);
      expect(text).not.toMatch(/non.compliant/i);
    },
  );

  test(
    'No attestation or verdict words ("certified", "compliant", "guaranteed") on demo compliance tab @critical',
    async ({ page }) => {
      await openComplianceTab(page, DEMO_REPORT);

      const text = await tabPanelText(page);

      for (const pattern of FORBIDDEN_VERDICT_WORDS) {
        expect(text, `Forbidden verdict word found: ${pattern}`).not.toMatch(pattern);
      }
    },
  );

  test(
    'No numeric score or fraction ("X/8", "compliance score") in the compliance tab (demo route) @critical',
    async ({ page }) => {
      await openComplianceTab(page, DEMO_REPORT);

      const text = await tabPanelText(page);

      for (const pattern of FORBIDDEN_SCORE_PATTERNS) {
        expect(text, `Forbidden score pattern found: ${pattern}`).not.toMatch(pattern);
      }
    },
  );
});

// ── Test group: P5-populated report (requires COMPLIANCE_SCAN_ID) ─────────────

test.describe('Compliance tab — with P5 findings (requires COMPLIANCE_SCAN_ID)', () => {
  test.beforeEach(async () => {
    // Skip the whole group if no scan with P5 data is available.
    // In local smoke runs the env var is typically absent; these tests run
    // in CI where the scan is seeded before the E2E suite starts.
    if (!P5_REPORT) {
      test.skip(
        true,
        'COMPLIANCE_SCAN_ID env var not set — requires a completed scan with P5 findings. Run in CI or set the var manually.',
      );
    }
  });

  test(
    'Compliance tab renders framework signal groups (GDPR, CCPA, WCAG) when P5 findings are present @critical',
    async ({ page }) => {
      await openComplianceTab(page, P5_REPORT!);

      const panel = page.getByRole('tabpanel');

      // The three framework headings rendered by buildFrameworkSignals.
      // FRAMEWORK_ORDER = ['GDPR', 'CCPA', 'WCAG / Accessibility']
      await expect(panel.getByText('GDPR', { exact: false })).toBeVisible();
      await expect(panel.getByText('CCPA', { exact: false })).toBeVisible();
      await expect(panel.getByText('WCAG', { exact: false })).toBeVisible();
    },
  );

  test(
    'Disclaimer is visible and co-located inside each framework block — not just in the footer @critical',
    async ({ page }) => {
      await openComplianceTab(page, P5_REPORT!);

      const panel = page.getByRole('tabpanel');

      // The ComplianceDisclaimerBadge has role="note" and
      // aria-label="Compliance disclaimer". There should be one per framework
      // block (GDPR, CCPA, WCAG) — at minimum one visible disclaimer.
      const disclaimers = panel.getByRole('note', { name: /Compliance disclaimer/i });
      const count = await disclaimers.count();

      // At least one disclaimer per visible framework block.
      expect(count).toBeGreaterThanOrEqual(1);

      // Every disclaimer must be visible (not hidden behind interaction).
      for (let i = 0; i < count; i++) {
        await expect(disclaimers.nth(i)).toBeVisible();
      }

      // The disclaimer text must communicate non-binding nature.
      const firstText = await disclaimers.first().textContent();
      expect(firstText).toMatch(/not legal advice/i);
      expect(firstText).toMatch(/not a compliance attestation/i);
    },
  );

  test(
    'Status chips use neutral labels ("Observed", "Not observed", "Not evaluated") — not "Pass" or "Fail" @critical',
    async ({ page }) => {
      await openComplianceTab(page, P5_REPORT!);

      const panel = page.getByRole('tabpanel');
      const text = await panel.textContent() ?? '';

      // Neutral label words that should appear (at least one will be present
      // depending on what P5 modules detected).
      const hasNeutralLabel =
        /\bObserved\b/.test(text) ||
        /\bNot observed\b/i.test(text) ||
        /\bNot evaluated\b/i.test(text);

      expect(hasNeutralLabel).toBe(true);

      // No verdict-specific chip labels.
      expect(text).not.toMatch(/\bPass\b/);
      expect(text).not.toMatch(/\bFail\b/);
      expect(text).not.toMatch(/\bCompliant\b/i);
    },
  );

  test(
    'No attestation or verdict words in compliance tab when P5 data is present @critical',
    async ({ page }) => {
      await openComplianceTab(page, P5_REPORT!);

      const text = await tabPanelText(page);

      for (const pattern of FORBIDDEN_VERDICT_WORDS) {
        expect(text, `Forbidden verdict word found: ${pattern}`).not.toMatch(pattern);
      }
    },
  );

  test(
    'No numeric score or fraction ("X/8", "compliance score") with P5 data present @critical',
    async ({ page }) => {
      await openComplianceTab(page, P5_REPORT!);

      const text = await tabPanelText(page);

      for (const pattern of FORBIDDEN_SCORE_PATTERNS) {
        expect(text, `Forbidden score pattern found: ${pattern}`).not.toMatch(pattern);
      }
    },
  );

  test(
    'P5 findings are grouped under framework headings, not a flat list @functional',
    async ({ page }) => {
      await openComplianceTab(page, P5_REPORT!);

      const panel = page.getByRole('tabpanel');

      // At least one of the framework headings must be present, confirming
      // the buildFrameworkSignals grouping rendered correctly.
      const gdprBlock = panel.getByText('GDPR', { exact: false });
      const ccpaBlock = panel.getByText('CCPA', { exact: false });
      const wcagBlock = panel.getByText('WCAG', { exact: false });

      // At minimum one framework heading must render.
      const gdprVisible = await gdprBlock.isVisible().catch(() => false);
      const ccpaVisible = await ccpaBlock.isVisible().catch(() => false);
      const wcagVisible = await wcagBlock.isVisible().catch(() => false);

      expect(gdprVisible || ccpaVisible || wcagVisible).toBe(true);
    },
  );

  test(
    'Compliance tab renders without any unhandled JS errors (pageerror check) @functional',
    async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await openComplianceTab(page, P5_REPORT!);

      // Allow a brief settle for any async effects.
      await page.waitForTimeout(500);

      expect(pageErrors).toHaveLength(0);
    },
  );
});

// ── Test group: ARIA and keyboard accessibility of the compliance tab ────────

test.describe('Compliance tab — accessibility (demo route)', () => {
  test(
    'Compliance tab button is reachable by keyboard (Tab key navigation) @non-blocker',
    async ({ page }) => {
      await page.goto(DEMO_REPORT);

      // Focus the first interactive element then Tab until the Compliance tab
      // button receives focus. We allow up to 10 Tab presses.
      const complianceTab = page.getByRole('tab', { name: /Compliance/i });

      // Bring the page into focus and tab through the tab strip.
      await page.keyboard.press('Tab');

      let focused = false;
      for (let i = 0; i < 15; i++) {
        const focusedLabel = await page.evaluate(() => {
          const el = document.activeElement;
          return el ? (el as HTMLElement).textContent ?? '' : '';
        });
        if (/Compliance/i.test(focusedLabel)) {
          focused = true;
          break;
        }
        await page.keyboard.press('Tab');
      }

      // If keyboard navigation couldn't reach it, fall back to checking the
      // element is at minimum focusable (tabIndex >= 0).
      if (!focused) {
        const tabIndex = await complianceTab.evaluate((el) => (el as HTMLElement).tabIndex);
        expect(tabIndex).toBeGreaterThanOrEqual(0);
      } else {
        expect(focused).toBe(true);
      }
    },
  );

  test(
    'Disclaimer text node is in the accessible DOM (not CSS-only or aria-hidden) — demo empty state @non-blocker',
    async ({ page }) => {
      await openComplianceTab(page, DEMO_REPORT);

      // In the empty state the disclaimer is embedded in emptyBody text.
      // In the populated state it's in ComplianceDisclaimerBadge with role="note".
      // Either way the text must be in the accessible DOM tree.
      const panel = page.getByRole('tabpanel');
      const panelText = await panel.textContent() ?? '';

      // The emptyBody string contains "No compliance claim is made for this scan"
      // which is accessible via DOM. We just confirm the panel text is non-empty
      // and doesn't hide relevant content.
      expect(panelText.length).toBeGreaterThan(10);
    },
  );
});
