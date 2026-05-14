# Phase 2 — Manual smoke test plan

Manual checklist for the user-side exit items in `BUILD_PHASE.md` ("Exit checklist for Phase 2"). Phase 2 is **code-complete** but not closed until every P1 test below has a green check and the post-deploy Sentry watch passes.

**Last updated:** 2026-05-14
**Owner:** human running the dev server. Claude has shipped the code; you confirm it actually works.

---

## How to use this doc

1. Boot the app cold (kill any running dev server, then `npm run dev`).
2. Open browser DevTools → Console **and** Network tabs. Leave them open the whole session.
3. Run each test in order top-to-bottom. P1 tests block Phase 2 close; P2 tests are nice-to-have.
4. For each test: tick the box when green, paste any error / unexpected output under the test.
5. At the end, sign off in the section at the bottom.

**Conventions:**
- `P1` = blocks Phase 2 close.
- `P2` = should pass but won't block close if it doesn't (file a follow-up issue).
- "DevTools clean" means: no red `Error` lines in Console, no failed requests in Network (other than the deliberate 404s noted in each test).

---

## Pre-flight

Required env vars in `.env.local` (must all be set before testing):

```
AUTH_ENABLED=true
AUTH_PROVIDER=nextauth
NEXT_PUBLIC_AUTH_ENABLED=true
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<any 32-char random string>
GITHUB_ID=<your GH OAuth client id>
GITHUB_SECRET=<your GH OAuth client secret>
GOOGLE_CLIENT_ID=<your Google OAuth client id>
GOOGLE_CLIENT_SECRET=<your Google OAuth client secret>
DATABASE_URL=<your Postgres URL>
```

Optional but recommended:

```
UPSTASH_REDIS_REST_URL=<from console.upstash.com>      # enables real /verify rate limiting
UPSTASH_REDIS_REST_TOKEN=<from console.upstash.com>
SENTRY_DSN=<your Sentry DSN>                            # required for §2.9 post-deploy check
STRIPE_ENABLED=true                                     # required for §2.8 payment tests
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_ONE_SHOT=price_...
STRIPE_PRICE_ID_PRO_MONTHLY=price_...
STRIPE_PRICE_ID_STUDIO_MONTHLY=price_...
```

For Stripe webhook testing locally, run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` in a second terminal.

---

## Auth wiring (§2.7)

- [ ] **A1 (P1) — Sign in via Google.** From the homepage, click "Sign in" in nav → `/login` → "Continue with Google". Complete OAuth. Expected: lands on `/dashboard`. DevTools clean.
- [ ] **A2 (P1) — Sign in via GitHub.** Sign out first, then same flow with GitHub. Expected: lands on `/dashboard`. DevTools clean.
- [ ] **A3 (P2) — Credentials form fails honestly.** On `/login`, type any email+password and submit. Expected: "Invalid credentials" error. This is a *known pre-existing gap* — no `CredentialsProvider` is registered in `nextauth-config.ts`. Either wire it up later or hide the form.
- [ ] **A4 (P1) — Sign out.** Open avatar menu → "Sign out". Expected: redirected to homepage; "Sign in" button reappears in nav.
- [ ] **A5 (P1) — Protected-route redirect.** While signed out, visit `/dashboard`, `/verify`, `/active-test` directly. Expected: each redirects to `/login?next=<path>` with the path URL-encoded.
- [ ] **A6 (P1) — Open-redirect blocked.** Visit `/login?next=//evil.com`, sign in. Expected: lands on `/dashboard` (the `//evil.com` is rejected by `sanitizeNext`). Repeat with `/login?next=https://evil.com` — same expected result.
- [ ] **A7 (P2) — `next` param honored.** Sign out. Visit `/login?next=/verify`. Sign in. Expected: lands on `/verify`, not `/dashboard`.
- [ ] **A8 (P2) — Avatar dropdown UX.** Click avatar → menu opens. Click outside → closes. Open again → press Escape → closes. Click "Dashboard" → navigates correctly.

---

## Dashboard (§2.1)

- [ ] **D1 (P1) — Empty state.** Use a fresh account with zero scans. Visit `/dashboard`. Expected: stat cards show `0` / `0` / `—` / `0`; "Recent scans" section shows the "No scans yet — paste a URL on the homepage" card with a "Run your first scan" CTA. DevTools clean.
- [ ] **D2 (P1) — Stat cards with real data.** Run at least 2 scans (D3 below), then return to `/dashboard`. Expected: Total scans count matches reality; Critical issues sums correctly; Avg. grade displays a letter; Monitored sites = distinct URL count.
- [ ] **D3 (P1) — Scan list populates.** Each scan you run appears in the "Recent scans" table desktop / mobile cards. Grade chip color matches grade. "View" link navigates to `/report/<id>`.
- [ ] **D4 (P2) — Trend strings sensible.** Critical-issues card shows "Require immediate attention" if any critical findings exist, "All clear" if zero, blank if no scans.

---

## Landing scan counter (§2.6)

- [ ] **L1 (P1) — Real count displayed.** Visit `/` while signed out. The pulse-dot line should show your *actual* weekly scan count (likely a small number in dev). Should *not* show `4,247`. Should *not* show `2,847 developers upgraded`.
- [ ] **L2 (P2) — Cache de-dups.** Open Network tab. Hard-refresh `/` five times within 60s. Expected: only the first request hits `/api/v1/stats/scan-count`; subsequent ones are served from browser/CDN cache. Server-side, only one Prisma query fires.
- [ ] **L3 (P2) — Fetch failure handles gracefully.** Stop the dev server, reload the homepage from a cached page if possible (or just simulate by editing the endpoint to return 500 temporarily). Expected: counter shows `—`, no error toast, no console crash.

---

## Scan progress (§2.4)

- [ ] **S1 (P1) — Real scan runs.** From homepage, paste your own domain → "Scan Free". Expected: redirects to `/scan/<id>`. Spinner appears. Module rows tick from `○` → `⏳` → `✓` as `module_complete` events fire. ETA counter ticks down. Eventually redirects to `/report/<id>`.
- [ ] **S2 (P1) — ETA overrun banner.** Use a slow target (e.g. a site that takes >60s to scan). After elapsed > 60s, the "Taking longer than usual" banner appears. Banner disappears when scan completes.
- [ ] **S3 (P2) — Stuck detector.** Hard to reproduce without breaking the stream. Workaround: kill the dev server mid-scan and reload `/scan/<id>`. After 30s of no events, the "Still working…" warning banner appears with a "Start a new scan" CTA.
- [ ] **S4 (P1) — Failure surface.** In dev tools, kill the scan worker mid-run (or visit `/scan/<id>` for a scan with `status = FAILED` in the DB). Expected: red `ScanFailedCard` with retry + dashboard CTAs and the scan ID. *Not* a redirect to `/?error=scan_failed`.
- [ ] **S5 (P2) — Demo route still works.** Visit `/scan/demo`. Expected: 60-second mock progression, redirects to `/report/demo`.

---

## Report viewing (§2.5)

- [ ] **R1 (P1) — Own scan visible.** Sign in. Click a scan from your dashboard. Expected: full report renders.
- [ ] **R2 (P1) — Anonymous scan shareable.** Sign out. Paste a URL on the homepage → run a scan (it's anonymous, `userId = null`). Copy the `/report/<id>` URL. Open it in an incognito window. Expected: report loads. (This validates the public-anonymous-scan rule.)
- [ ] **R3 (P1) — Cross-user access blocked.** Sign in as User A, run a scan, copy the `/report/<id>` URL. Sign out, sign in as User B (different account). Visit User A's report URL. Expected: "Report not found" 404 page. *Not* the report itself. **This is the privacy fix from §2.5; verify it works.**
- [ ] **R4 (P1) — PDF export.** From a completed own-scan report, click the PDF button in nav. Expected: PDF downloads with filename `vibesafe-<host>-<date>.pdf`. Open it; report content is present.
- [ ] **R5 (P2) — Cross-user PDF blocked.** Same as R3 but for PDF: signed-in as User B, hit `/api/v1/scans/<userA-scan-id>/pdf`. Expected: 404 JSON response.
- [ ] **R6 (P2) — Demo report works.** Visit `/report/demo`. Expected: BAD_SCAN fixture renders. No console errors.

---

## Verify page (§2.2)

- [ ] **V1 (P1) — Domain entry form.** Visit `/verify` (no query string). Expected: domain entry form appears asking "Which domain are you verifying?".
- [ ] **V2 (P1) — Token issued.** Enter `example.com` → Continue. Expected: URL becomes `/verify?domain=example.com`, full verify flow renders, token displayed in DNS record + meta tag is real (not `vibesafe-verify=a7f3c2e1d4b8`).
- [ ] **V3 (P1) — DNS check honest failure.** Click "Verify DNS record" without setting up DNS. Expected: red `Couldn't find the record yet…` message *with a specific reason from the server* ("No TXT records found…" or "No vibesafe-verify TXT record found…"). Not a random success/failure.
- [ ] **V4 (P1) — Meta-tag check honest failure.** Click "Verify meta tag" without setting up the tag. Expected: specific reason ("No vibesafe-verify meta tag found in the homepage <head>" or "Domain responded with HTTP …").
- [ ] **V5 (P1) — Real success.** Set up a real TXT record (or meta tag) on a domain you own. Click verify. Expected: green check, "you can now run active tests", `DomainVerification.verifiedAt` populated in DB.
- [ ] **V6 (P2) — Rate limit.** Only meaningful with `UPSTASH_REDIS_REST_URL` set. Click "Verify" rapidly 12+ times in 60 seconds. Expected: after the 10th attempt, 429 response with "Too many checks for this domain" message; `Retry-After` header present.
- [ ] **V7 (P2) — Same token on re-init.** Submit `example.com` from the entry form twice (or visit `/verify?domain=example.com` twice). Expected: same token shown both times (idempotent `getOrCreateVerification`).

---

## Active testing (§2.3)

- [ ] **T1 (P1) — Step 1 input.** Visit `/active-test`. Expected: target chooser, with a domain input under "Live website". GitHub repo card is greyed "Coming soon" and unclickable.
- [ ] **T2 (P1) — Verification gate (unverified path).** Enter an unverified domain → Continue → "Check verification". Expected: red "We couldn't confirm ownership…" banner with "Open verify wizard" link.
- [ ] **T3 (P1) — Verify wizard linked correctly.** Click "Open verify wizard". Expected: lands on `/verify?domain=<your-domain>` with that domain pre-filled.
- [ ] **T4 (P1) — Verification gate (verified path).** Return to `/active-test` with a verified domain. Step 2 → "Check verification" → green banner → auto-advances to Step 3.
- [ ] **T5 (P1) — Start active test.** Step 3: select 2-3 tests → "Start active test". Expected: advances to Step 4. Network tab shows POST to `/api/v1/active-test/start` with 201 response containing `scan_id` and `estimated_seconds`.
- [ ] **T6 (P1) — SSE progress.** Step 4: each selected probe ticks from idle → `IconSpinner` → `IconCheckCircle` as `probe_started` / `probe_complete` events fire. Network tab shows EventStream on `/api/v1/active-test/<id>/progress`.
- [ ] **T7 (P1) — Results all-passed.** Step 5: header shows "No findings — <domain>"; all selected probes appear in the passed list. Findings cards section is empty (stub probes produce no findings — this is the **honest** Phase 2 behavior).
- [ ] **T8 (P2) — Idempotency.** Watch the Network panel during T5. The `Idempotency-Key` header is sent on POST. *If* you re-trigger the same start (e.g., browser back + forward), the second request should return `idempotent: true` and the same `scan_id`.
- [ ] **T9 (P2) — "Run another test" resets.** From Step 5, click "Run another test". Expected: back to Step 1 with fresh state.

---

## Payments (§2.8) — requires Stripe test keys

- [ ] **P1 (P1) — Checkout URL per tier.** While signed in, visit `/pricing` → click "One-shot" → expect redirect to a Stripe Checkout page with the one-shot price. Cancel back to site. Repeat for Pro and Studio.
- [ ] **P2 (P1) — `client_reference_id` sent.** Open DevTools Network during P1. The POST to `/api/v1/checkout` returns a `url` containing a Stripe session ID. In Stripe Dashboard, find that session and confirm `client_reference_id` matches your User.id. (This validates the auth-linking fix.)
- [ ] **P3 (P1) — Tier upgrade on checkout success.** Complete a test purchase using Stripe's test card `4242 4242 4242 4242`. Watch the `stripe listen` terminal output. After `checkout.session.completed`, check the database: `User.tier` for your user should match the purchased tier.
- [ ] **P4 (P1) — Customer portal opens.** While signed in with `stripeCustomerId` set, POST `/api/v1/billing/portal` (via Network tab or curl). Expected: 200 response with a `url` field. Open that URL — Stripe Customer Portal loads showing your subscription.
- [ ] **P5 (P2) — Anonymous checkout still works.** Sign out. Visit `/pricing` → checkout. Expected: Stripe Checkout asks for email, complete with a new email, webhook creates new User row.
- [ ] **P6 (P2) — Subscription deletion downgrades.** From the Stripe Customer Portal (P4), cancel the subscription. After Stripe fires `customer.subscription.deleted`, check DB: `User.tier` should be `free`.

---

## Cross-cutting (final sweep before sign-off)

- [ ] **X1 (P1) — No console errors anywhere.** Replay every flow above with Console open. Expected: zero red lines. Yellow warnings are acceptable but note unusual ones.
- [ ] **X2 (P1) — No unhandled rejections.** DevTools Sources tab → "Pause on uncaught exceptions" enabled. Replay flows. Expected: no pauses on rejected promises.
- [ ] **X3 (P1) — Sentry captures with user attribution.** With `SENTRY_DSN` set, deliberately trigger an error (e.g., visit a malformed scan ID). Check Sentry dashboard: the event should be attributed to your signed-in user (look for "User" panel showing your id/email/tier).
- [ ] **X4 (P2) — Scan-scope tag in Sentry.** During an active scan, trigger an error in a scan-scoped route (e.g., visit `/api/v1/scans/<some-id>` with a bad id). Sentry event should have a `scan_id` tag.
- [ ] **X5 (P2) — Sentry transaction breakdown.** Visit several different routes, then check Sentry's Performance tab. Each route should appear as its own transaction with p50/p95 numbers populating.

---

## Post-deploy (after merging to main + deploying to production)

- [ ] **PD1 (P1) — 48-hour Sentry error-rate watch.** Sentry should show no error spikes on the new endpoints for 48 hours after deploy. If it does: roll back or hot-fix before declaring Phase 2 closed.
- [ ] **PD2 (P1) — Sentry UI dashboard built.** Build a Performance dashboard in Sentry showing per-route p50/p95/p99 for the new Phase 2 routes (`/api/v1/dashboard/stats`, `/api/v1/scans` GET, `/api/v1/verify/*`, `/api/v1/active-test/*`, `/api/v1/stats/scan-count`, `/api/v1/billing/portal`).
- [ ] **PD3 (P1) — Slow-query alert configured.** Sentry Alerts → New alert → Performance condition `transaction.duration > 1000ms` filtered by `transaction.op = http.server`. Notify channel: whatever the team uses.

---

## Sign-off

Once **every P1 box is green**, paste your name + date below and update `BUILD_PHASE.md`:

- Mark Phase 2 status → ✅ Done with the close date
- Move Phase 2.5 from `⏳ Queued` to `🚧 Next` (or 4.5, per the discussion in this doc's companion conversation)

Tested by: ______________________
Date: ______________________
Production deploy SHA: ______________________
