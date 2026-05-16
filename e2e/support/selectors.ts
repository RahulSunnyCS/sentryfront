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
 * Using this helper is optional — Playwright's `getByTestId` is equally
 * valid — but it gives a single canonical place to change the attribute
 * name if the project ever migrates from `data-testid` to another scheme.
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
 * Equivalent to `page.locator(sel(testId))` but reads more naturally in
 * test bodies.
 */
export function byTestId(page: Page, testId: string) {
  return page.locator(sel(testId));
}
