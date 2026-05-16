/**
 * Accessibility E2E tests for the landing page — non-hermetic.
 *
 * Uses @axe-core/playwright to run the axe accessibility engine against
 * the fully-rendered /en page and asserts zero violations with impact
 * 'serious' or 'critical'.
 *
 * Minor and moderate violations are intentionally tolerated: they may
 * represent pre-existing cosmetic issues in third-party components or
 * styling decisions that are tracked separately. This file guards the
 * product's own a11y promise without blocking on legacy noise.
 *
 * Tagging: the single test carries @functional because an a11y regression
 * at the serious/critical level is a real functional regression (e.g. a
 * screen-reader user cannot operate the scan form), but it is not in the
 * same class as a total blackout of the page or a broken scan path.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('@functional landing page has no serious or critical accessibility violations', async ({
  page,
}) => {
  await page.goto('/en');

  // Wait for the page to be interactive before running axe so that
  // dynamically rendered content (the hero form, animated headline, FAQ)
  // is present in the DOM. Playwright's auto-waiting on goto covers the
  // initial load; the explicit wait for the submit button ensures the
  // client-side React tree has hydrated before axe analyses the DOM.
  await page.locator('[data-testid="hero-scan-submit"]').waitFor({ state: 'visible' });

  const results = await new AxeBuilder({ page }).analyze();

  // Filter to only the impact levels that represent real user-facing
  // failures. 'minor' and 'moderate' violations are skipped because they
  // often surface from third-party styles or cosmetic issues that do not
  // prevent a user from operating the page.
  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );

  // Build a human-readable summary to include in the failure message so
  // engineers can triage without having to re-run the suite locally.
  const violationSummary = seriousOrCritical
    .map((v) => {
      const nodeInfo = v.nodes
        .slice(0, 3) // cap at 3 nodes per rule to keep the output readable
        .map((n) => n.target.join(', '))
        .join(' | ');
      return `[${v.impact}] ${v.id}: ${v.description} — nodes: ${nodeInfo}`;
    })
    .join('\n');

  expect(
    seriousOrCritical,
    `Found ${seriousOrCritical.length} serious/critical axe violation(s):\n${violationSummary}`,
  ).toHaveLength(0);
});
