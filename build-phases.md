# Build Phases — VibeSafe

## Phase: Geographic Payment Localization

### Scope (v1)
Three regions to start — US, Europe, and India. Covers the majority of addressable market
while keeping Stripe config, currency tables, and tax logic tractable. Expand to SE Asia /
LATAM in a follow-up phase.

---

### Phase G1 — Geo Detection

Detect the user's region on every request so downstream logic can branch on it.

**Implementation:**
- Server: read `x-vercel-ip-country` header (Vercel sets this automatically) or
  Cloudflare's `CF-IPCountry`. Fall back to `Accept-Language` browser locale.
- Define a `Region` type: `'us' | 'eu' | 'in' | 'unknown'`
- Create `src/lib/geo.ts` — `getRegion(req: NextRequest): Region`
- Pass region to checkout API and pricing components via a Next.js cookie or
  a root layout server component that forwards it as a prop.

**Files to create/modify:**
- `src/lib/geo.ts` — region detection utility
- `src/app/layout.tsx` — read region server-side, store in cookie
- `src/app/api/v1/checkout/route.ts` — accept `region` in request body

---

### Phase G2 — Regional Pricing (PPP Adjustments)

India is priced lower due to purchasing power parity. Europe and US share USD/EUR pricing.

| Tier       | US (USD) | Europe (EUR) | India (INR) |
|------------|----------|--------------|-------------|
| One-Shot   | $9       | €8           | ₹299        |
| Pro        | $29/mo   | €25/mo       | ₹799/mo     |
| Studio     | $79/mo   | €69/mo       | ₹1,999/mo   |

**Implementation:**
- Create separate Stripe Price objects in each currency in the Stripe Dashboard.
- Add env vars per region:
  ```
  # US
  STRIPE_PRICE_ID_ONE_SHOT_US=price_...
  STRIPE_PRICE_ID_PRO_MONTHLY_US=price_...
  STRIPE_PRICE_ID_STUDIO_MONTHLY_US=price_...

  # EU
  STRIPE_PRICE_ID_ONE_SHOT_EU=price_...
  STRIPE_PRICE_ID_PRO_MONTHLY_EU=price_...
  STRIPE_PRICE_ID_STUDIO_MONTHLY_EU=price_...

  # India
  STRIPE_PRICE_ID_ONE_SHOT_IN=price_...
  STRIPE_PRICE_ID_PRO_MONTHLY_IN=price_...
  STRIPE_PRICE_ID_STUDIO_MONTHLY_IN=price_...
  ```
- Update `src/lib/stripe/client.ts` — `STRIPE_PRICES` becomes a map keyed by region.
- Update `src/components/pricing-card.tsx` — accept `region` prop; display localized
  price and currency symbol.

---

### Phase G3 — Regional Payment Methods

Use Stripe's **PaymentElement** (replaces the current redirect-to-Checkout approach)
so Stripe automatically surfaces the right local payment methods per region.

| Region | Payment Methods |
|--------|----------------|
| US     | Visa/MC/Amex, Apple Pay, Google Pay, ACH Direct Debit |
| Europe | Visa/MC, Apple Pay, Google Pay, SEPA Direct Debit, iDEAL (NL), Bancontact (BE), Klarna |
| India  | UPI (Google Pay, PhonePe, Paytm), Netbanking, Rupay cards |

**Implementation:**
- Add `@stripe/stripe-js` and `@stripe/react-stripe-js` to `dependencies`.
- Create `src/app/checkout/page.tsx` — embedded Stripe PaymentElement flow.
- Update `/api/v1/checkout/route.ts`:
  - Create a `PaymentIntent` (one-shot) or `SetupIntent` (subscription) instead of
    a Checkout Session.
  - Pass `automatic_payment_methods: { enabled: true }` — Stripe handles the rest.
  - For India UPI: set `currency: 'inr'` and Stripe will show UPI automatically.
- For subscriptions (Pro/Studio): use Stripe Billing with `payment_behavior: 'default_incomplete'`
  and collect payment method via PaymentElement before confirming.

**EU-specific:**
- Enable SEPA Direct Debit in Stripe Dashboard → Payment Methods.
- iDEAL and Bancontact are enabled automatically for EUR PaymentIntents.

**India-specific:**
- Enable UPI in Stripe Dashboard → Payment Methods → India.
- Set `currency: 'inr'` on the PaymentIntent — Stripe shows UPI + cards automatically.

---

### Phase G4 — Tax Compliance

| Region | Tax Type | Stripe Feature |
|--------|----------|----------------|
| US     | Sales tax (state-level) | Stripe Tax — automatic |
| Europe | VAT (20–25% depending on country) | Stripe Tax — automatic + EU VAT ID collection |
| India  | GST (18%) | Stripe Tax — automatic for IN merchants |

**Implementation:**
- Enable **Stripe Tax** in the Stripe Dashboard (one-click).
- Add `automatic_tax: { enabled: true }` to all Checkout Sessions / PaymentIntents.
- For EU B2B: add `tax_id_collection: { enabled: true }` to collect VAT IDs so
  reverse-charge applies (0% VAT for verified EU businesses).
- No code changes needed beyond the two flags above — Stripe Tax handles rate lookup,
  line-item display, and remittance reporting.

---

### Phase G5 — Pricing UI Localization

**Implementation:**
- `src/lib/geo.ts` exports `formatPrice(amount: number, region: Region): string`
  using `Intl.NumberFormat` with the correct locale and currency code.
- `src/components/pricing-card.tsx` — receives `region` from server component,
  renders the correct localized price string and billing period label.
- Add a subtle "Prices shown in [currency]" note below the pricing grid.
- No hard-coded price strings — all amounts come from the regional pricing config.

---

### Rollout Order

```
G1 (Geo Detection) → G2 (Regional Pricing) → G3 (Payment Methods) → G4 (Tax) → G5 (UI)
```

G1 and G2 are blockers for everything else. G3 can proceed in parallel with G4 once G2
is done. G5 is the last UI polish step.

---

### What's Intentionally Out of Scope (v1)

- Currency conversion at runtime (prices are fixed per region, not floating FX)
- Additional regions: SE Asia (GrabPay, FPX), LATAM (PIX, OXXO), Japan (Konbini)
- Multi-currency invoicing / proration on plan upgrades across regions
- Displaying prices in the user's preferred currency if it differs from their region default
