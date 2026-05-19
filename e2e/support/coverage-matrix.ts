/**
 * VibeSafe E2E Coverage Matrix — auto-derives page/component → spec mapping.
 *
 * Purpose (T-16, context-pack.md constraint memo):
 *   "The coverage matrix is a documented mapping, not 31 mount harnesses."
 *
 * This file serves two roles:
 *   1. STATIC DOCUMENTATION — a human-readable data table that maps every
 *      item in the surface inventory (context-pack.md §"Surface inventory")
 *      to the spec file(s) that exercise it. This is the authoritative record
 *      reviewed during Phase 4 + Phase 7.
 *   2. RUNTIME HELPER — a `deriveOrphanedItems()` function consumed by
 *      e2e/coverage-matrix.spec.ts to fail the @non-blocker gate if any
 *      inventory item has zero mapped specs.
 *
 * Coverage taxonomy used in the 'coverage' field:
 *   DIRECT        — The spec navigates to the page or asserts a testid/role
 *                   that the component exposes on a real page.
 *   TRANSITIVE    — The spec navigates to a host page that always renders
 *                   the component (e.g. nav/footer on every [locale] page),
 *                   without asserting the component's specific testid/role.
 *                   Accepted for pure-presentational shell components that
 *                   have no interactive behaviour contract of their own.
 *   CONDITIONAL   — The component only renders when a feature flag or env
 *                   var is set that is NOT present in the e2e webServer env.
 *                   Documented explicitly so it is never silently orphaned.
 *   PARTIAL       — A test stub (test.fixme) exists but cannot be fully
 *                   automated at the E2E layer without modifying source or
 *                   using a test-trigger route that does not yet exist.
 *
 * Surface inventory source: pipeline/context-pack.md §"Surface inventory"
 * (28 pages + 31 components = 59 items total).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ORPHAN POLICY
 * ─────────────────────────────────────────────────────────────────────────────
 * An item is an ORPHAN if it has no spec entry at all, OR all its entries
 * have type === 'CONDITIONAL' and no DIRECT/TRANSITIVE/PARTIAL entry exists.
 * The coverage-matrix.spec.ts @non-blocker test calls deriveOrphanedItems()
 * and FAILS if the returned array is non-empty, so genuine orphans surface
 * explicitly rather than being silently green.
 *
 * The only current CONDITIONAL item is mock-mode-banner — it only renders
 * when the FEATURES.mockMode flag is true, which is not set in the e2e
 * webServer env (playwright.config.ts). This is recorded honestly; the
 * @non-blocker test treats CONDITIONAL-only as a soft-warning, not a hard
 * fail, because the item IS documented and the gap is env-driven (not missing
 * test coverage for an always-rendered surface). See ORPHAN_POLICY comment
 * in coverage-matrix.spec.ts for the exact fail/warn split.
 */

// ── Type definitions ──────────────────────────────────────────────────────────

/**
 * A single spec entry for a coverage matrix item.
 *
 * spec  — relative path from the e2e/ directory root (e.g. 'landing.spec.ts').
 * type  — coverage type (see taxonomy in file header).
 * note  — optional human-readable rationale; required for TRANSITIVE, CONDITIONAL,
 *          and PARTIAL entries so the reviewer understands why the type is not DIRECT.
 */
export interface CoverageEntry {
  spec: string;
  type: 'DIRECT' | 'TRANSITIVE' | 'CONDITIONAL' | 'PARTIAL';
  note?: string;
}

/**
 * A single item in the surface inventory.
 *
 * id       — unique slug matching the surface-inventory name.
 * kind     — 'page' | 'component'.
 * path     — URL path (pages) or component source path (components).
 * coverage — ordered list of CoverageEntry objects. An empty array is an orphan.
 */
export interface InventoryItem {
  id: string;
  kind: 'page' | 'component';
  path: string;
  coverage: CoverageEntry[];
}

// ── Surface inventory + coverage matrix ───────────────────────────────────────
// Source: context-pack.md §"Surface inventory" — 28 pages + 31 components.
// Each item's coverage is derived from reading all e2e/*.spec.ts files (READ-ONLY).
// Spec file paths are relative to e2e/ (omit the e2e/ prefix).

export const INVENTORY: InventoryItem[] = [

  // ════════════════════════════════════════════════════════════════════════════
  // PAGES (28)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'page/landing',
    kind: 'page',
    path: 'src/app/[locale]/(landing)/page.tsx',
    coverage: [
      { spec: 'landing.spec.ts', type: 'DIRECT' },
      { spec: 'landing.a11y.spec.ts', type: 'DIRECT' },
      { spec: 'locale-switch.spec.ts', type: 'DIRECT', note: 'Navigates to /en as the switch origin.' },
      { spec: 'components.spec.ts', type: 'DIRECT', note: 'Toast trigger, locale-switcher, theme-toggle, chat-widget tests all navigate to /en.' },
    ],
  },

  {
    id: 'page/scan/[id]',
    kind: 'page',
    path: 'src/app/[locale]/scan/[id]/page.tsx',
    coverage: [
      { spec: 'scan.spec.ts', type: 'DIRECT' },
      { spec: 'scan.a11y.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/dashboard',
    kind: 'page',
    path: 'src/app/[locale]/dashboard/page.tsx',
    coverage: [
      { spec: 'dashboard.spec.ts', type: 'DIRECT' },
      { spec: 'dashboard.a11y.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/report/[id]',
    kind: 'page',
    path: 'src/app/[locale]/report/[id]/page.tsx',
    coverage: [
      { spec: 'report-pages.spec.ts', type: 'DIRECT' },
      { spec: 'report-pages.a11y.spec.ts', type: 'DIRECT' },
      { spec: 'performance-report.spec.ts', type: 'DIRECT' },
      { spec: 'compliance-report.spec.ts', type: 'DIRECT' },
      { spec: 'report-calibration.spec.ts', type: 'DIRECT' },
      { spec: 'security-modules.spec.ts', type: 'DIRECT', note: 'Imports scanner modules directly and seeds DB to assert report-page rendering.' },
    ],
  },

  {
    id: 'page/report/[id]/print',
    kind: 'page',
    path: 'src/app/[locale]/report/[id]/print/page.tsx',
    coverage: [
      { spec: 'report-pages.spec.ts', type: 'DIRECT', note: 'Navigates to /en/report/<id>/print in the print-variant section.' },
      { spec: 'performance-report.spec.ts', type: 'DIRECT', note: 'null-safety-03a/03b navigate to the print URL.' },
    ],
  },

  {
    id: 'page/active-test',
    kind: 'page',
    path: 'src/app/[locale]/active-test/page.tsx',
    coverage: [
      { spec: 'active-test.spec.ts', type: 'DIRECT' },
      { spec: 'active-test.a11y.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/pricing',
    kind: 'page',
    path: 'src/app/[locale]/pricing/page.tsx',
    coverage: [
      { spec: 'checkout.spec.ts', type: 'DIRECT' },
      { spec: 'checkout.a11y.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/checkout/success',
    kind: 'page',
    path: 'src/app/[locale]/checkout/success/page.tsx',
    coverage: [
      { spec: 'checkout.spec.ts', type: 'DIRECT' },
      { spec: 'checkout.a11y.spec.ts', type: 'DIRECT', note: 'Navigates to /en/checkout/success?test=true&tier=pro.' },
    ],
  },

  {
    id: 'page/demo/accessibility',
    kind: 'page',
    path: 'src/app/[locale]/demo/accessibility/page.tsx',
    coverage: [
      { spec: 'static-pages.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/demo/performance',
    kind: 'page',
    path: 'src/app/[locale]/demo/performance/page.tsx',
    coverage: [
      { spec: 'static-pages.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/demo/seo',
    kind: 'page',
    path: 'src/app/[locale]/demo/seo/page.tsx',
    coverage: [
      { spec: 'static-pages.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/docs',
    kind: 'page',
    path: 'src/app/[locale]/docs/page.tsx',
    coverage: [
      { spec: 'static-pages.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/legal/contact',
    kind: 'page',
    path: 'src/app/[locale]/legal/contact/page.tsx',
    coverage: [
      { spec: 'static-pages.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/legal/privacy',
    kind: 'page',
    path: 'src/app/[locale]/legal/privacy/page.tsx',
    coverage: [
      { spec: 'static-pages.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/legal/terms',
    kind: 'page',
    path: 'src/app/[locale]/legal/terms/page.tsx',
    coverage: [
      { spec: 'static-pages.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/login',
    kind: 'page',
    path: 'src/app/[locale]/login/page.tsx',
    coverage: [
      { spec: 'auth.spec.ts', type: 'DIRECT' },
      { spec: 'auth.a11y.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/signup',
    kind: 'page',
    path: 'src/app/[locale]/signup/page.tsx',
    coverage: [
      { spec: 'auth.spec.ts', type: 'DIRECT' },
      { spec: 'auth.a11y.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/verify',
    kind: 'page',
    path: 'src/app/[locale]/verify/page.tsx',
    coverage: [
      { spec: 'auth.spec.ts', type: 'DIRECT' },
      { spec: 'auth.a11y.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/verify-email-sent',
    kind: 'page',
    path: 'src/app/[locale]/verify-email-sent/page.tsx',
    coverage: [
      { spec: 'auth.spec.ts', type: 'DIRECT' },
      { spec: 'auth.a11y.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/error.tsx',
    kind: 'page',
    path: 'src/app/[locale]/error.tsx',
    coverage: [
      {
        spec: 'static-pages.spec.ts',
        type: 'PARTIAL',
        note:
          'error.tsx is a Next.js React Error Boundary that only renders when a component ' +
          'throws. There is no navigable URL for it. The test is marked test.fixme with a ' +
          'documented reason. A full behavioral test requires a dedicated error-trigger route ' +
          'that does not exist in this codebase.',
      },
    ],
  },

  {
    id: 'page/not-found.tsx',
    kind: 'page',
    path: 'src/app/[locale]/not-found.tsx',
    coverage: [
      { spec: 'static-pages.spec.ts', type: 'DIRECT', note: 'Navigates to a guaranteed 404 path and asserts the redirect chain resolves cleanly.' },
    ],
  },

  {
    id: 'page/internal/users',
    kind: 'page',
    path: 'src/app/internal/users/page.tsx',
    coverage: [
      { spec: 'internal.spec.ts', type: 'DIRECT' },
      { spec: 'internal.a11y.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/internal/cron',
    kind: 'page',
    path: 'src/app/internal/cron/page.tsx',
    coverage: [
      { spec: 'internal.spec.ts', type: 'DIRECT' },
      { spec: 'internal.a11y.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/internal/features',
    kind: 'page',
    path: 'src/app/internal/features/page.tsx',
    coverage: [
      { spec: 'internal.spec.ts', type: 'DIRECT' },
      { spec: 'internal.a11y.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/internal/fp-rates',
    kind: 'page',
    path: 'src/app/internal/fp-rates/page.tsx',
    coverage: [
      { spec: 'internal.spec.ts', type: 'DIRECT' },
      { spec: 'internal.a11y.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/internal/dispositions',
    kind: 'page',
    path: 'src/app/internal/dispositions/page.tsx',
    coverage: [
      { spec: 'internal.spec.ts', type: 'DIRECT' },
      { spec: 'internal.a11y.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/internal/scans/[id]',
    kind: 'page',
    path: 'src/app/internal/scans/[id]/page.tsx',
    coverage: [
      { spec: 'internal.spec.ts', type: 'DIRECT' },
      { spec: 'internal.a11y.spec.ts', type: 'DIRECT' },
    ],
  },

  {
    id: 'page/auth/popup-start',
    kind: 'page',
    path: 'src/app/auth/popup-start/page.tsx',
    coverage: [
      { spec: 'auth.spec.ts', type: 'DIRECT', note: 'Verifies the OAuth popup-start route is reachable and renders its shell.' },
    ],
  },

  {
    id: 'page/auth/popup-callback',
    kind: 'page',
    path: 'src/app/auth/popup-callback/page.tsx',
    coverage: [
      { spec: 'auth.spec.ts', type: 'DIRECT', note: 'Verifies the OAuth popup-callback route is reachable (renders a message or redirects).' },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // COMPONENTS (31)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'component/accessibility-grade',
    kind: 'component',
    path: 'src/components/accessibility-grade.tsx',
    coverage: [
      {
        spec: 'report-pages.spec.ts',
        type: 'TRANSITIVE',
        note:
          'Rendered inside accessibility-section on the report/[id] page. ' +
          'report-pages.spec.ts asserts the accessibility-section is visible ' +
          'as part of the full multi-domain report (success state), which ' +
          'always includes the accessibility-grade ring.',
      },
    ],
  },

  {
    id: 'component/accessibility-section',
    kind: 'component',
    path: 'src/components/accessibility-section.tsx',
    coverage: [
      { spec: 'report-pages.spec.ts', type: 'DIRECT', note: 'Asserted present in the multi-domain report success-state test.' },
    ],
  },

  {
    id: 'component/ai-improvement-suggestions',
    kind: 'component',
    path: 'src/components/ai-improvement-suggestions.tsx',
    coverage: [
      { spec: 'report-pages.spec.ts', type: 'DIRECT', note: 'The report-pages spec asserts the AI suggestions section is rendered (performance-section async fetch path).' },
    ],
  },

  {
    id: 'component/auth-button',
    kind: 'component',
    path: 'src/components/auth-button.tsx',
    coverage: [
      { spec: 'landing.spec.ts', type: 'DIRECT', note: 'landing.spec.ts asserts the nav auth-button is visible on the landing page.' },
      { spec: 'auth.spec.ts', type: 'DIRECT', note: 'auth.spec.ts asserts auth-button state transitions (signed-in vs signed-out).' },
    ],
  },

  {
    id: 'component/chat-widget',
    kind: 'component',
    path: 'src/components/chat-widget.tsx',
    coverage: [
      {
        spec: 'components.spec.ts',
        type: 'DIRECT',
        note:
          'Dedicated interaction test: navigates to /en, opens the chat bubble, ' +
          'types a message, sends it, asserts the message appears in chat history. ' +
          'ChatWidget is mounted in src/app/[locale]/layout.tsx line 174.',
      },
    ],
  },

  {
    id: 'component/checkout-button',
    kind: 'component',
    path: 'src/components/checkout-button.tsx',
    coverage: [
      { spec: 'checkout.spec.ts', type: 'DIRECT', note: 'checkout.spec.ts navigates to /en/pricing and asserts the checkout-button CTAs open the confirm modal.' },
    ],
  },

  {
    id: 'component/copy-button',
    kind: 'component',
    path: 'src/components/copy-button.tsx',
    coverage: [
      {
        spec: 'report-pages.spec.ts',
        type: 'DIRECT',
        note:
          'copy-button is rendered inside ai-improvement-suggestions / finding detail. ' +
          'report-pages.spec.ts asserts its presence in the multi-domain report success state.',
      },
    ],
  },

  {
    id: 'component/core-web-vitals',
    kind: 'component',
    path: 'src/components/core-web-vitals.tsx',
    coverage: [
      { spec: 'performance-report.spec.ts', type: 'DIRECT', note: 'performance-report.spec.ts seeds a CrUX scan and asserts the CoreWebVitals section renders field data / verdict chip.' },
    ],
  },

  {
    id: 'component/finding-card',
    kind: 'component',
    path: 'src/components/finding-card.tsx',
    coverage: [
      { spec: 'report-pages.spec.ts', type: 'DIRECT', note: 'report-pages.spec.ts asserts finding-card rows render in the report findings list.' },
    ],
  },

  {
    id: 'component/footer',
    kind: 'component',
    path: 'src/components/footer.tsx',
    coverage: [
      {
        spec: 'landing.spec.ts',
        type: 'TRANSITIVE',
        note:
          'Footer is a pure-presentational shell component rendered on every [locale] page ' +
          'via layout.tsx. landing.spec.ts navigates to /en and the footer is present in the DOM. ' +
          'landing.a11y.spec.ts runs axe on the full page including the footer.',
      },
      { spec: 'landing.a11y.spec.ts', type: 'TRANSITIVE', note: 'axe scans the full landing page including the footer.' },
    ],
  },

  {
    id: 'component/grade-display',
    kind: 'component',
    path: 'src/components/grade-display.tsx',
    coverage: [
      {
        spec: 'report-pages.spec.ts',
        type: 'DIRECT',
        note:
          'GradeDisplay ring renders in the report header (overall security grade). ' +
          'report-pages.spec.ts asserts the report header grade circle is visible ' +
          'in the multi-domain report success state.',
      },
    ],
  },

  {
    id: 'component/icons',
    kind: 'component',
    path: 'src/components/icons.tsx',
    coverage: [
      {
        spec: 'landing.spec.ts',
        type: 'TRANSITIVE',
        note:
          'Icons is a collection of SVG components used throughout the UI (nav, footer, ' +
          'finding-card, etc.). landing.spec.ts navigates to /en which renders multiple ' +
          'icon instances. No dedicated icon-specific testid is needed because icons are ' +
          'pure-presentational SVG wrappers with no interactive behaviour.',
      },
    ],
  },

  {
    id: 'component/locale-switcher',
    kind: 'component',
    path: 'src/components/locale-switcher.tsx',
    coverage: [
      {
        spec: 'locale-switch.spec.ts',
        type: 'DIRECT',
        note:
          'locale-switch.spec.ts (T-17) directly asserts the locale-switcher testid is ' +
          'visible on /en and the select option triggers URL navigation.',
      },
      {
        spec: 'components.spec.ts',
        type: 'DIRECT',
        note:
          'components.spec.ts asserts the locale-switcher is present, operable, ' +
          'and has all 5 locale options. This is the interaction-behaviour assertion; ' +
          'the full round-trip is locale-switch.spec.ts territory.',
      },
    ],
  },

  {
    id: 'component/logo',
    kind: 'component',
    path: 'src/components/logo.tsx',
    coverage: [
      {
        spec: 'landing.spec.ts',
        type: 'TRANSITIVE',
        note:
          'Logo is a pure-presentational component rendered in the Nav on every [locale] page. ' +
          'landing.spec.ts navigates to /en and the nav (including logo) is present. ' +
          'No dedicated logo testid is needed because it has no interactive behaviour contract.',
      },
    ],
  },

  {
    id: 'component/mock-mode-banner',
    kind: 'component',
    path: 'src/components/mock-mode-banner.tsx',
    coverage: [
      {
        spec: '',
        type: 'CONDITIONAL',
        note:
          'mock-mode-banner renders ONLY when the FEATURES.mockMode feature flag is true. ' +
          'The e2e webServer env (playwright.config.ts) does NOT set FEATURES to enable ' +
          'mockMode — the banner is therefore never visible in the standard e2e run. ' +
          'No spec can observe it without modifying the webServer env, which requires a ' +
          'dedicated test-env e2e project that does not exist. ' +
          'This is a genuine env-gated gap, not missing coverage for an always-rendered surface. ' +
          'To close it: add an e2e project variant with FEATURES=\'{"mockMode":true}\' and a ' +
          'targeted smoke test for the banner.',
      },
    ],
  },

  {
    id: 'component/nav',
    kind: 'component',
    path: 'src/components/nav.tsx',
    coverage: [
      {
        spec: 'landing.spec.ts',
        type: 'TRANSITIVE',
        note:
          'Nav is a pure-presentational shell component rendered on every [locale] page. ' +
          'landing.spec.ts navigates to /en and asserts nav-level elements (auth-button, ' +
          'logo). landing.a11y.spec.ts runs axe on the full page including the nav.',
      },
      { spec: 'landing.a11y.spec.ts', type: 'TRANSITIVE', note: 'axe scans the full landing page including the nav.' },
    ],
  },

  {
    id: 'component/payment-modal',
    kind: 'component',
    path: 'src/components/payment-modal.tsx',
    coverage: [
      {
        spec: 'checkout.spec.ts',
        // DIRECT: the test "@functional payment-modal upsell opens on 402 and
        // shows tier plan names" (Phase 4.5 C1 fix) directly opens and asserts
        // data-testid="payment-modal" by intercepting POST /api/v1/scans → 402,
        // which triggers the PaymentRequiredError → openModal() path in
        // landing-hero.tsx. Tier plan names ('One-Shot', 'Active Pack', 'Monitor')
        // are asserted visible; no dollar amount is asserted (May-2026 pivot rule).
        type: 'DIRECT',
        note:
          'checkout.spec.ts asserts the payment-modal upsell dialog opens from the ' +
          'landing hero on a mocked 402 from POST /api/v1/scans, then verifies all ' +
          'three tier plan names are visible and no CTA label is a dollar amount. ' +
          'Test name: "@functional payment-modal upsell opens on 402 and shows tier plan names".',
      },
    ],
  },

  {
    id: 'component/pdf-export-button',
    kind: 'component',
    path: 'src/components/pdf-export-button.tsx',
    coverage: [
      {
        spec: 'report-pages.spec.ts',
        type: 'DIRECT',
        note:
          'pdf-export-button appears in the report-view nav/header. ' +
          'report-pages.spec.ts asserts it is present in the report page success state.',
      },
    ],
  },

  {
    id: 'component/performance-grade',
    kind: 'component',
    path: 'src/components/performance-grade.tsx',
    coverage: [
      {
        spec: 'performance-report.spec.ts',
        type: 'DIRECT',
        note:
          'performance-report.spec.ts (best-practices-04, ui-04) asserts the ' +
          'best-practices-grade element and performance grade are visible as distinct elements.',
      },
    ],
  },

  {
    id: 'component/performance-section',
    kind: 'component',
    path: 'src/components/performance-section.tsx',
    coverage: [
      { spec: 'performance-report.spec.ts', type: 'DIRECT', note: 'performance-report.spec.ts extensively asserts the performance-section (CrUX, unavailable, desktop sub-section, etc.).' },
      { spec: 'report-pages.spec.ts', type: 'DIRECT', note: 'report-pages.spec.ts asserts the performance-section is present in the multi-domain report success state.' },
    ],
  },

  {
    id: 'component/pricing-card',
    kind: 'component',
    path: 'src/components/pricing-card.tsx',
    coverage: [
      { spec: 'checkout.spec.ts', type: 'DIRECT', note: 'checkout.spec.ts asserts all three pricing-card elements are rendered on /en/pricing.' },
      { spec: 'checkout.a11y.spec.ts', type: 'DIRECT', note: 'checkout.a11y.spec.ts asserts pricing-card count and runs axe on the pricing page.' },
    ],
  },

  {
    id: 'component/providers',
    kind: 'component',
    path: 'src/components/providers.tsx',
    coverage: [
      {
        spec: 'landing.spec.ts',
        type: 'TRANSITIVE',
        note:
          'Providers wraps every [locale] page via layout.tsx ' +
          '(SessionProvider → ToastProvider → PaymentModalProvider). ' +
          'landing.spec.ts navigates to /en which always renders through Providers. ' +
          'The SessionProvider and ToastProvider are exercised by auth.spec.ts and ' +
          'components.spec.ts respectively.',
      },
      { spec: 'auth.spec.ts', type: 'TRANSITIVE', note: 'SessionProvider (part of Providers) is exercised by auth.spec.ts session-management tests.' },
      { spec: 'components.spec.ts', type: 'TRANSITIVE', note: 'ToastProvider (part of Providers) is exercised by the toast interaction test in components.spec.ts.' },
    ],
  },

  {
    id: 'component/scan-report/missed-issue-button',
    kind: 'component',
    path: 'src/components/scan-report/missed-issue-button.tsx',
    coverage: [
      {
        spec: 'report-pages.spec.ts',
        type: 'DIRECT',
        note:
          'The ScanLevelMissedButton (missed-issue-button) appears in the report-view. ' +
          'report-pages.spec.ts asserts it is present in the multi-domain report success state.',
      },
    ],
  },

  {
    id: 'component/seo-grade',
    kind: 'component',
    path: 'src/components/seo-grade.tsx',
    coverage: [
      {
        spec: 'report-pages.spec.ts',
        type: 'TRANSITIVE',
        note:
          'seo-grade renders inside seo-section on the report/[id] page. ' +
          'report-pages.spec.ts asserts the seo-section is visible as part of the ' +
          'full multi-domain report success state, which always includes the seo-grade ring.',
      },
    ],
  },

  {
    id: 'component/seo-section',
    kind: 'component',
    path: 'src/components/seo-section.tsx',
    coverage: [
      { spec: 'report-pages.spec.ts', type: 'DIRECT', note: 'report-pages.spec.ts asserts seo-section is present in the multi-domain report success state.' },
    ],
  },

  {
    id: 'component/severity-badge',
    kind: 'component',
    path: 'src/components/severity-badge.tsx',
    coverage: [
      {
        spec: 'report-pages.spec.ts',
        type: 'TRANSITIVE',
        note:
          'severity-badge is a pure-presentational component rendered inside each finding-card. ' +
          'report-pages.spec.ts asserts finding-card rows are visible in the report page, ' +
          'which always includes severity-badge spans. No dedicated severity-badge testid is ' +
          'needed because it is a display-only component with no interactive behaviour.',
      },
    ],
  },

  {
    id: 'component/severity-summary',
    kind: 'component',
    path: 'src/components/severity-summary.tsx',
    coverage: [
      { spec: 'report-pages.spec.ts', type: 'DIRECT', note: 'report-pages.spec.ts asserts severity-summary is visible in the report header (all-zeros state and multi-domain state).' },
    ],
  },

  {
    id: 'component/theme-toggle',
    kind: 'component',
    path: 'src/components/theme-toggle.tsx',
    coverage: [
      {
        spec: 'components.spec.ts',
        type: 'DIRECT',
        note:
          'Dedicated interaction test: navigates to /en, clicks the theme-toggle, asserts ' +
          'data-theme attribute flip and localStorage.theme persistence across a reload. ' +
          'NOTE: ThemeToggle is not currently mounted in any page/layout in the product source. ' +
          'The test will fail until the component is mounted. This is documented in the test ' +
          'with a descriptive error message so the gap is visible.',
      },
    ],
  },

  {
    id: 'component/toast',
    kind: 'component',
    path: 'src/components/toast.tsx',
    coverage: [
      {
        spec: 'components.spec.ts',
        type: 'DIRECT',
        note:
          'Dedicated interaction test: navigates to /en, submits "localhost" to trigger a ' +
          '422 rejection, asserts the toast appears with role="alert" and correct text, ' +
          'then clicks the dismiss button and asserts the toast disappears. ' +
          'ToastProvider is mounted via src/components/providers.tsx → layout.tsx.',
      },
    ],
  },

  {
    id: 'component/verify-email-nudge',
    kind: 'component',
    path: 'src/components/verify-email-nudge.tsx',
    coverage: [
      {
        spec: 'auth.spec.ts',
        type: 'DIRECT',
        note:
          'verify-email-nudge renders after successful signup to prompt the user to verify ' +
          'their email. auth.spec.ts tests the signup flow and asserts the post-signup state, ' +
          'which includes the verify-email-nudge surface.',
      },
    ],
  },

  {
    id: 'component/wcag-compliance',
    kind: 'component',
    path: 'src/components/wcag-compliance.tsx',
    coverage: [
      { spec: 'report-pages.spec.ts', type: 'DIRECT', note: 'report-pages.spec.ts asserts wcag-compliance section is visible in the multi-domain report success state.' },
    ],
  },
];

// ── Orphan detection helpers ───────────────────────────────────────────────────

/**
 * An orphan is an inventory item where every coverage entry is CONDITIONAL (or
 * the coverage array is empty). Items with at least one DIRECT, TRANSITIVE, or
 * PARTIAL entry are considered covered.
 *
 * The distinction between ORPHAN and CONDITIONAL-ONLY:
 *   - Empty coverage array          → hard orphan (missing spec entirely)
 *   - CONDITIONAL-only entries      → soft orphan (env-gated, documented gap)
 *   - Any DIRECT/TRANSITIVE/PARTIAL → covered
 *
 * coverage-matrix.spec.ts uses this function to drive the @non-blocker gate:
 *   - Hard orphans cause the test to FAIL.
 *   - Soft orphans (CONDITIONAL-only) are logged as warnings but do NOT fail.
 */
export interface OrphanResult {
  item: InventoryItem;
  /** 'hard' if coverage is empty; 'soft' if all entries are CONDITIONAL. */
  severity: 'hard' | 'soft';
}

export function deriveOrphanedItems(): OrphanResult[] {
  const orphans: OrphanResult[] = [];

  for (const item of INVENTORY) {
    if (item.coverage.length === 0) {
      // No entries at all — hard orphan.
      orphans.push({ item, severity: 'hard' });
      continue;
    }

    const hasRealCoverage = item.coverage.some(
      (entry) =>
        entry.type === 'DIRECT' ||
        entry.type === 'TRANSITIVE' ||
        entry.type === 'PARTIAL',
    );

    if (!hasRealCoverage) {
      // All entries are CONDITIONAL — soft orphan (env-gated gap).
      orphans.push({ item, severity: 'soft' });
    }
  }

  return orphans;
}

/**
 * Returns a human-readable summary of the coverage matrix:
 *   - Total items, covered items, orphan counts.
 *   - Used by coverage-matrix.spec.ts to produce informational output even
 *     when the test passes.
 */
export interface CoverageSummary {
  total: number;
  pages: number;
  components: number;
  covered: number;
  hardOrphans: number;
  softOrphans: number;
  orphanDetails: OrphanResult[];
}

export function getCoverageSummary(): CoverageSummary {
  const orphans = deriveOrphanedItems();
  const hardOrphans = orphans.filter((o) => o.severity === 'hard').length;
  const softOrphans = orphans.filter((o) => o.severity === 'soft').length;

  return {
    total: INVENTORY.length,
    pages: INVENTORY.filter((i) => i.kind === 'page').length,
    components: INVENTORY.filter((i) => i.kind === 'component').length,
    covered: INVENTORY.length - orphans.length,
    hardOrphans,
    softOrphans,
    orphanDetails: orphans,
  };
}
