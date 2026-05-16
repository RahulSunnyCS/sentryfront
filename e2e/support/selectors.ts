/**
 * Centralised selector constants for VibeSafe E2E tests.
 *
 * All data-testid values mirror what T-03 added to landing-hero.tsx.
 * Keeping them here means a rename in the product code requires exactly
 * one edit — here — rather than hunting across every spec file.
 */

import { type Page } from '@playwright/test';

// ── data-testid constants ──────────────────────────────────────────────────

/** The hero scan <form> (role="search") on the landing page. */
export const HERO_SCAN_FORM = 'hero-scan-form';

/** The URL <input> inside the hero scan form. */
export const HERO_URL_INPUT = 'hero-url-input';

/** The submit <button> inside the hero scan form. */
export const HERO_SCAN_SUBMIT = 'hero-scan-submit';

/**
 * The "See pricing" <Link> in the FinalCTASection at the bottom of the
 * landing page.
 */
export const FINAL_CTA_PRICING = 'final-cta-pricing';

// ── Selector-string helpers ────────────────────────────────────────────────

/**
 * Returns the CSS attribute selector string for a data-testid value.
 *
 * Kept for raw-string use cases (e.g. page.locator(sel('x') + ' input')).
 * For simple element lookups prefer byTestId(), which uses page.getByTestId()
 * and delegates the attribute name to the single home in playwright.config.ts
 * (AR-L2: testIdAttribute: 'data-testid').
 *
 * Example:
 *   page.locator(sel('hero-url-input'))
 *   // → page.locator('[data-testid="hero-url-input"]')
 */
export function sel(testId: string): string {
  return `[data-testid="${testId}"]`;
}

/**
 * Shorthand: returns a Playwright Locator for the given data-testid on the
 * supplied Page.
 *
 * AR-L2: Uses page.getByTestId() so the attribute name ('data-testid') is
 * configured in exactly one place — playwright.config.ts use.testIdAttribute.
 * testId must be the raw id value (e.g. 'hero-url-input'), not a CSS selector.
 */
export function byTestId(page: Page, testId: string) {
  // AR-L2: getByTestId() reads the configured testIdAttribute from
  // playwright.config.ts rather than hard-coding '[data-testid="..."]' here.
  return page.getByTestId(testId);
}
