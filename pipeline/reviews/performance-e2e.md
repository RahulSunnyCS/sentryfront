# Performance Review — Phase 4

Verdict: **PASS** — Critical: 0 · High: 0 · Medium: 0 · Low: 7
(2 product-path observations, 5 test-infrastructure informational)

No product-path performance regressions introduced.

Product-path (Low, non-blocking, consistent with existing patterns):
- T-19 active-test/page.tsx now async + getCurrentUser() (2 serial DB reads)
  on render — identical to every other protected page (dashboard/verify/
  report); flag-guarded so flag-off is byte-identical. Cross-cutting
  `cache()` memoization of getCurrentUser is a pre-existing app-wide gap, not
  for this PR.
- T-20 NavPreferences renders LocaleSwitcher/ThemeToggle during the session
  `loading` window then unmounts when authenticated → transient ~96px layout
  shift (CLS) on every signed-in page load. Fix (follow-up, non-blocking):
  render with `visibility:hidden` when signed-in instead of returning null,
  to reserve layout space. Documented tradeoff either way.

Test-infra (Low, informational): workers:1 serial + 120s per-test timeout =
high CI wall-time ceiling (mitigations: per-test 30s override, @slow opt-in
suite, future sharding); seedUserWithScans N sequential inserts (could be
createMany); per-call Prisma client with misleading "Singleton" comment.

T-01 guard early-return = strictly better (no DB I/O on prod+flag). T-18
dead-code removal = smaller bundle, no regression. No new client packages
(LocaleSwitcher deps were already imported by the old PreferenceRows).

Most actionable: NavPreferences CLS — follow-up, does not block this PR.
