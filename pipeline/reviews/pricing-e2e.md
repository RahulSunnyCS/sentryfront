# Pricing Review — Phase 4 (tag-gated)

Verdict: **CONDITIONAL PASS** — Critical: 0 · High: 0 · Medium: 1 · Low: 1

All five Phase-1 pricing constraints honored:

1. **PASS** — PAYMENT_TEST_FLOW prod guard fully closed (route.ts:41-61): prod+flag
   → 404 byte-identical to payments-disabled 404, before getCurrentUser/
   prisma.user.update; T-01 vitest proves no DB write / no leak.
2. **PASS** — CREDITS_BY_TIER {one-shot:1, pro:5, studio:0} asserted exactly
   (payment-test-flow-outcomes.test.ts): one-shot +1, pro +5 one-time (NOT
   subscription — defensive assert no subscription/stripeSubscriptionId in the
   write), studio tier-only + credits NOT incremented. Matches business.md.
3. **PASS** — T-19 active-test tier gate two-layer (page.tsx:137-147 +
   start/route.ts:28-36), min tier `one-shot` via hasTier (no hard-coded
   hierarchy), API gate before domain/scan work; E2E proves both directions.
   The documented revenue/authz gap is closed.
4. **PASS** — No real Stripe (inert mocks), no dollar amounts asserted
   (DOLLAR_AMOUNT negative guard), PAYMENT_TEST_FLOW absent from webServer.env.
5. **MEDIUM (advisory, accepted-risk — no code change)** — T-09 acceptance #4
   (post free→one-shot bypass reaches active-test) is proven only at the vitest
   precondition layer, not a single E2E round-trip, because PAYMENT_TEST_FLOW
   cannot be set per-test on the shared Playwright server (same constraint as
   T-01 / Phase-1 C4). Residual risk is dev/staging-only (prod guard closes the
   bypass entirely) and low — the NextAuth session callback re-reads tier from
   DB per request. Accepted limitation, documented; no fix required.

**LOW (advisory)** — `src/app/[locale]/active-test/page.tsx:12,18`
metadata.description / openGraph.description contain hardcoded "$5,000" /
"$3.48" marketing copy (pre-existing, surfaced to crawlers). Not a billing
logic defect. Condition to upgrade to PASS: replace the specific figures with
non-price-anchored copy.

Condition for PASS: remove the two hardcoded dollar figures in active-test
page metadata. The Medium item is accepted-risk documentation, not a fix.
