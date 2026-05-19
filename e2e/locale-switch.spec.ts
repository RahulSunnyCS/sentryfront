/**
 * Locale-switch mechanism smoke test — @functional (D3)
 *
 * What this tests:
 *   From the default /en landing page, selecting each non-default locale
 *   (hi, ml, es, de) via the LocaleSwitcher <select> component must:
 *     1. Navigate the browser to a URL whose path begins with /{locale}/
 *     2. Render a hero heading that no longer contains the en-locale string
 *        "technically solid" (the heroTitleLine2 value in en.json).
 *
 * What this does NOT test:
 *   This is mechanism-only (Decision D3). It asserts that the switch
 *   MECHANISM works — the URL changes and the rendered content changes.
 *   It does NOT audit every next-intl translation key for completeness or
 *   correctness. next-intl key-presence coverage lives in Vitest unit tests.
 *   A full per-locale content audit at the E2E layer would couple the spec
 *   to every string in the i18n catalogs and break on any copy update.
 *
 * Stable landmark:
 *   We use the heroTitleLine2 rendered inside <h1 id="hero-heading"> as the
 *   stable landmark.  Line 2 is rendered as direct text content (after <br />)
 *   in HeroHeadlineAnim — it is not part of the animated swap, so its text
 *   content is stable immediately after the page settles (no animation timing
 *   dependency).  The en string "technically solid" is unique to the en locale
 *   (verified against hi/ml/es/de.json); asserting it is absent after switching
 *   is sufficient to confirm the content language changed.
 *
 * No auth / no seed:
 *   The landing page is publicly accessible.  No session cookie, no DB seed,
 *   and no use of the auth-seed helpers is required or present in this file.
 */

import { test, expect } from '@playwright/test';
import { LOCALE_SWITCHER } from './support/selectors';

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * The heroTitleLine2 English string (en.json key: landing.heroTitleLine2).
 * It is rendered as direct (non-animated) text inside <h1 id="hero-heading">.
 * After a successful locale switch this string must NOT be visible.
 */
const EN_HERO_LINE2 = 'technically solid';

/**
 * All non-default locales to smoke-test. Ordered to match i18n/routing.ts
 * definition (en is skipped — it is the default and the switch origin).
 */
const NON_DEFAULT_LOCALES = ['hi', 'ml', 'es', 'de'] as const;
type NonDefaultLocale = (typeof NON_DEFAULT_LOCALES)[number];

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Navigate to /en (default landing), use the LocaleSwitcher <select> to pick
 * the target locale, then assert:
 *   - The URL path starts with `/${locale}/` (locale segment changed)
 *   - The hero heading no longer contains the English line-2 string
 *
 * We do NOT assert the exact localized string here — that is a content audit.
 * We only assert that the English text is gone, proving the switch fired.
 */
async function assertLocaleSwitchMechanism(
  page: import('@playwright/test').Page,
  locale: NonDefaultLocale,
) {
  // Start from the canonical English landing page each time so every locale
  // is tested from the same origin and test isolation is preserved.
  await page.goto('/en');

  // Wait for the hero heading to stabilise before interacting — this avoids
  // a race where the select fires before Next.js has finished hydrating.
  // The <h1 id="hero-heading"> is always rendered server-side, but the
  // LocaleSwitcher is a client component and must hydrate before onChange works.
  await expect(page.locator('#hero-heading')).toBeVisible();

  // The switcher renders in two placements (desktop nav bar + mobile slide-out
  // menu, one visible per viewport). Scope to the one inside <nav> — the
  // mobile-menu copy is portaled to <body>, outside <nav> — so this stays a
  // single, unambiguous, visible locator at the desktop test viewport.
  const localeSwitcher = page.locator('nav').getByTestId(LOCALE_SWITCHER);
  await expect(localeSwitcher).toBeVisible();

  // Confirm we start with the English content so the "no longer en" assertion
  // later is meaningful (not a vacuous pass if the heading never had en text).
  await expect(page.locator('#hero-heading')).toContainText(EN_HERO_LINE2);

  // Select the target locale via the <select> element.
  // page.selectOption resolves immediately when the DOM value changes and the
  // change event fires — the transition itself is async (next-intl router
  // replace + Next.js navigation), so we follow with a waitForURL.
  await localeSwitcher.selectOption(locale);

  // Wait for the URL to reflect the new locale segment.
  // The regex anchors to the path start: /{locale}/ or /{locale} (trailing
  // slash optional — tolerant of Next.js config differences).
  // actionTimeout (15 s) covers the router transition on a cold dev server.
  await page.waitForURL(new RegExp(`^https?://[^/]+/${locale}(/|$)`));

  // Confirm the rendered hero heading no longer contains the English line-2
  // text. We use `not.toContainText` rather than asserting the exact localized
  // string so the test does not couple to the translation catalogs.
  await expect(page.locator('#hero-heading')).not.toContainText(EN_HERO_LINE2);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// QA-checklist case: "🟡 Switching locale changes the rendered content language"
// ID: locale-switch-mechanism | Tag: @functional
// "From /en, use the locale-switcher to switch to hi, ml, es, de in turn."

test('@functional locale-switcher switches to Hindi (hi)', async ({ page }) => {
  await assertLocaleSwitchMechanism(page, 'hi');
});

test('@functional locale-switcher switches to Malayalam (ml)', async ({ page }) => {
  await assertLocaleSwitchMechanism(page, 'ml');
});

test('@functional locale-switcher switches to Spanish (es)', async ({ page }) => {
  await assertLocaleSwitchMechanism(page, 'es');
});

test('@functional locale-switcher switches to German (de)', async ({ page }) => {
  await assertLocaleSwitchMechanism(page, 'de');
});
