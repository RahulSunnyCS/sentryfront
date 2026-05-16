# Business & Product Context

VibeSafe is a freemium web-quality product. The deterministic scan is free to
run (≈$0 infrastructure cost); optional Claude AI enrichment of findings costs
≈$0.001/scan.

## Offering

- Free, deterministic Security + Performance + Accessibility + SEO scan of any URL.
- Optional AI enrichment (plain-English explanation, impact, and a fix prompt).
- PDF export of reports.
- Multi-locale UI (English default; Hindi, Malayalam, Spanish, German).
- Optional active DAST ("active-test") — deeper, intrusive testing, allowed
  only on domains whose ownership the user has verified.
- Sentry monitoring of the platform itself.

## Tiers (Stripe-gated)

Product tiers, lowest → highest: **free → one-shot → pro → studio**. Higher
tiers unlock more scans and the active DAST surface. Tier enforcement is
code-level (see technical context: `hasTier`, `tier-gating.ts`) — do not
restate the hierarchy elsewhere; this is its single home for the product view.

Stripe price mapping (from `.env.example`; subject to the May 2026 pricing
pivot):

- `STRIPE_PRICE_ID_ONE_SHOT` — "Verify": $9 one-time, 1 active DAST scan.
- `STRIPE_PRICE_ID_PRO_MONTHLY` — "Active Pack": $29 one-time, 5 DAST scans
  (now one-time; env name kept for migration).
- `STRIPE_PRICE_ID_STUDIO_MONTHLY` — "Monitor": $15/mo subscription, per-domain.

## Caveats

- `PAYMENT_TEST_FLOW=true` grants a tier without charging — **dev/staging
  only**, must be false in production (the checkout route hard-fails if set in
  prod). Remove the flag and its bypass branch before GA.
