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

// ── Auth: login form (src/app/[locale]/login/login-card.tsx) ───────────────
// The login card has TWO email-style submit paths (OAuth provider buttons +
// the credentials <form>). Specs need to target the credentials form and its
// fields unambiguously, so the form, its inputs and its submit get stable ids.
// Values are STATIC literals — never bound to the typed email/password.

/** The credentials <form> on the login page. */
export const LOGIN_FORM = 'login-form';
/** Email <input> in the login credentials form. */
export const LOGIN_EMAIL_INPUT = 'login-email-input';
/** Password <input> in the login credentials form. */
export const LOGIN_PASSWORD_INPUT = 'login-password-input';
/** Submit <button> in the login credentials form. */
export const LOGIN_SUBMIT = 'login-submit';
/** The inline error <p role="alert"> shown on a failed login. */
export const LOGIN_ERROR = 'login-error';

// ── Auth: signup form (src/app/[locale]/signup/signup-card.tsx) ────────────
// Same rationale as login — OAuth buttons + a credentials form coexist.

/** The credentials <form> on the signup page. */
export const SIGNUP_FORM = 'signup-form';
/** Name <input> in the signup form. */
export const SIGNUP_NAME_INPUT = 'signup-name-input';
/** Email <input> in the signup form. */
export const SIGNUP_EMAIL_INPUT = 'signup-email-input';
/** Password <input> in the signup form. */
export const SIGNUP_PASSWORD_INPUT = 'signup-password-input';
/** Submit <button> in the signup form. */
export const SIGNUP_SUBMIT = 'signup-submit';
/** The inline error <p role="alert"> shown on a failed signup. */
export const SIGNUP_ERROR = 'signup-error';

// ── Auth: verify-email-sent (resend-button.tsx) ────────────────────────────
// The control swaps between a button and two status <p> messages — text is
// locale/animated and ambiguous, so it gets a stable id for the resend action.

/** The "Resend verification email" <button>. */
export const RESEND_VERIFICATION_BUTTON = 'resend-verification-button';

// ── Auth: domain verify (verify/domain-entry.tsx) ──────────────────────────

/** The domain-entry <form> on the verify page. */
export const VERIFY_DOMAIN_FORM = 'verify-domain-form';
/** Domain <input> in the verify domain-entry form. */
export const VERIFY_DOMAIN_INPUT = 'verify-domain-input';
/** Submit <button> in the verify domain-entry form. */
export const VERIFY_DOMAIN_SUBMIT = 'verify-domain-submit';

// ── Auth: verify flow (verify/verify-flow.tsx) ─────────────────────────────
// The Verify button label is locale-translated AND varies by selected method
// (DNS vs meta), so a stable id avoids coupling specs to dynamic copy. The
// success line is a role="status" whose text is locale/animated.

/** The primary "Verify" <button> in the verify flow. */
export const VERIFY_SUBMIT = 'verify-submit';
/** The success <p role="status"> shown after a passing verification. */
export const VERIFY_SUCCESS = 'verify-success';

// ── Report-gate login modal (report/[id]/login-gate-modal.tsx) ─────────────
// A modal dialog whose two provider buttons share styling/role with the page
// nav auth button — disambiguated with a stable container id.

/** The login-gate modal dialog shown over a report. */
export const LOGIN_GATE_MODAL = 'login-gate-modal';

// ── Active-test wizard (active-test/active-test-flow.tsx) ──────────────────
// A 5-step wizard where each step renders its own <section> + advance button.
// Step text/labels are dynamic; the step controls repeat the same role across
// steps, so stable ids let specs assert step transitions deterministically.

/** Step 1 domain <input>. */
export const ACTIVE_TEST_DOMAIN_INPUT = 'active-test-domain-input';
/** Step 1 "Continue" advance <button>. */
export const ACTIVE_TEST_STEP1_CONTINUE = 'active-test-step1-continue';
/** Step 2 "Check verification" <button>. */
export const ACTIVE_TEST_CHECK_VERIFICATION = 'active-test-check-verification';
/** Step 3 "Start active test" <button>. */
export const ACTIVE_TEST_START = 'active-test-start';
/** The active-test results <section> shown in step 5. */
export const ACTIVE_TEST_RESULTS = 'active-test-results';

// ── Pricing / checkout (pricing-card + checkout-button + payment-modal) ────
// pricing-card renders N near-identical cards each with a checkout-button of
// the same role/label-family. payment-modal and checkout-button both render a
// role="dialog" with repeated tier CTAs. Stable ids disambiguate without
// binding to any tier price (May-2026 pivot — never assert dollar amounts).

/** A single pricing tier <article> card on the pricing page. */
export const PRICING_CARD = 'pricing-card';
/** The CTA <button> inside a checkout-button (opens the confirm modal). */
export const CHECKOUT_BUTTON = 'checkout-button';
/** The checkout-button confirm modal dialog. */
export const CHECKOUT_MODAL = 'checkout-modal';
/** The "Continue to secure checkout" confirm <button> inside that modal. */
export const CHECKOUT_CONFIRM = 'checkout-confirm';
/** The payment-modal upsell dialog. */
export const PAYMENT_MODAL = 'payment-modal';
/** The checkout/success confirmation <article>. */
export const CHECKOUT_SUCCESS = 'checkout-success';

// ── Dashboard scan history (dashboard/scan-history.tsx) ────────────────────
// The list re-renders on filter/sort/pagination — its container, the search
// box and the cursor "load more" button get stable ids so pagination specs
// don't race the re-render. Row content stays role/text-selectable (hybrid).

/** The scan-history <section> container. */
export const SCAN_HISTORY = 'scan-history';
/** The scan-history search <input>. */
export const SCAN_HISTORY_SEARCH = 'scan-history-search';
/** The cursor-pagination "load more" <button>. */
export const SCAN_HISTORY_LOAD_MORE = 'scan-history-load-more';

// ── Scan progress (scan/[id]/scan-progress.tsx) ────────────────────────────
// The page is heavily animated (two variants, drifting code, polling). The
// QA matrix needs the stable terminal state, not transient text, so the
// progress root and the failed-state card get stable ids.

/** The scan-progress root (present for both A and C variants). */
export const SCAN_PROGRESS = 'scan-progress';
/** The scan-failed <div role="alert"> card. */
export const SCAN_FAILED = 'scan-failed';

// ── Report view tabs (report/[id]/report-view.tsx) ─────────────────────────
// The report has a domain tab strip AND a findings filter tablist; both use
// role="tab" with locale/dynamic labels and repeated structure. Stable ids on
// the tabpanel and the filter tablist let the report specs assert the active
// domain section deterministically. Individual finding cards stay role/text.

/** The unified report tabpanel body (security/perf/a11y/seo/compliance). */
export const REPORT_TABPANEL = 'report-tabpanel';
/** The security-tab findings filter tablist (Critical / All / Passed). */
export const REPORT_FILTER_TABS = 'report-filter-tabs';

// ── Finding card disposition row (components/finding-card.tsx) ─────────────
// finding-card already exposed a disposition row; centralise its id here so
// selectors.ts stays the single home (no inline literal in product code).

/** The "Was this useful?" disposition button row inside a finding card. */
export const DISPOSITION_ROW = 'disposition-row';

// ── Standalone components (toast, locale-switcher, theme-toggle) ───────────
// toast is portalled and auto-dismisses (timing-sensitive); locale-switcher
// and theme-toggle are unlabelled icon/select controls reused across pages.

/** A single toast notification element. */
export const TOAST = 'toast';
/** The locale <select> in the standalone LocaleSwitcher. */
export const LOCALE_SWITCHER = 'locale-switcher';
/** The theme-toggle <button>. */
export const THEME_TOGGLE = 'theme-toggle';

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
