# Cross-Artifact Consistency Check (epic split — Opus decomposition pass)

Trigger: risk_level HIGH + 5 tags. Verifies every T-XX criterion traces to an
approved Plan Report item and contradicts no Phase-1 constraint memo.

## Traceability — every task → Plan item
- T-01 → Wave-0(a)/(b), D7 (404), pricing-memo prod-guard + no-DB-write (P6). OK
- T-02 → Wave-0(c) reconciliation + boot measurement. OK
- T-03 → Wave-1 globalSetup/config; arch memo (globalSetup, keep `npm run dev`, no extra browsers). OK
- T-04 → Wave-1 auth-seed; arch memo (DB-session NOT JWT, admin + tier isolation). OK
- T-05 → Wave-1 seeders userId-scoped; arch memo (new file, coexist w/ perf-db-seed). OK
- T-06 → Wave-1 testid sweep D1; arch memo (selectors single-home, ONE task, static literals, security-file diff). OK
- T-07 → Wave-1 PROBE; C6 Prisma-init hard-stop. OK
- T-08..T-14 → Waves 2/3 🔴 + R3 axe; QA checklist 🔴/🟡; pricing-memo cases in T-09/T-10; R6 existence-hiding in T-14. OK
- T-15 → 🟢 + mechanical-batching rule. OK
- T-16 → D2 coverage matrix / hostless components; arch memo (documented mapping, not mount harnesses). OK
- T-17 → D3 locale-switch mechanism only. OK

## Contradiction scan — none found
- Pricing memo vs tasks: studio=+0 credits (T-09 ✓), no dollar amounts (T-09/T-10 ✓),
  PAYMENT_TEST_FLOW per-spec never global (T-09 ✓ + T-03 forbids it in webServer.env ✓),
  payments-disabled→404 without flag (T-09 ✓). Consistent.
- Architecture memo vs tasks: testid sweep ONE task (T-06; all other tasks forbid
  src/** + selectors.ts → no parallel annotation race ✓); admin own file +
  distinct storageState + isolated user (T-14 ✓); keep `npm run dev` (T-03 ✓);
  no extra browser projects (T-03 ✓); DB-session not JWT (T-04 ✓). Consistent.
- FE↔BE contract: test-only except T-01 code fix. T-01 contract
  (prod+flag → 404 BEFORE getCurrentUser/prisma.user.update) is referenced
  identically by T-09 (depends on T-01). No divergent description.

## Independence (no shared file writes among parallel tasks)
- Wave-1 parallel set {T-03,T-04,T-05,T-06} write disjoint files
  (global-setup+playwright.config / auth-seed.ts / db-seed.ts /
  selectors.ts+src UI). Mutual files_forbidden enforce it.
- Wave-2/3 specs each own distinct e2e/*.spec.ts files. T-16 reads others
  read-only and depends on them (runs last). T-06 is the SOLE product-UI
  writer; every spec task forbids src/**.

## Lane fail-safe applied
risk_level HIGH → per-task minimum sonnet/high. T-15 & T-17 bumped
medium→high (model already sonnet). T-01/T-04/T-06/T-07/T-08/T-09/T-10/T-14
opus/high (security-critical: auth/payment/admin/cross-cutting). T-02/T-03/
T-05/T-11/T-12/T-13/T-15/T-16/T-17 sonnet/high.

VERDICT: PASS — no contradictions to surface; proceed to Phase 3 on approval.
