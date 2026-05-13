# Build Phases — Engineering Roadmap

**Source of truth for shipped state and what comes next.**
Companion to `PHASES.md` (which tracks the product/business narrative). This doc is the honest engineering plan: what's actually built, what's mocked, and the order we'll harden it.

**Last updated:** 2026-05-13
**Current phase:** Phase 2 — Replace mock data with real backend wiring

---

## Operating rules

1. **No new top-level features ship until the current phase is closed.** Patches and bug fixes are fine in any phase; net-new product surface is not.
2. **Every phase has an exit checklist.** A phase isn't "done" until every box is ticked.
3. **`HARDCODED.md` is the contract for Phase 2.** Every entry there must be replaced or the file must be deleted.
4. **Review before adding.** Phase 3 (review & harden what exists) runs *before* Phase 4 (new product surface like active testing). We do not bolt new features onto unaudited foundations.

---

## Phase 1 — Frontend redesign & SEO foundation ✅

**Goal:** Deliver a production-quality marketing site, dashboard shell, and supporting flows that match the demo design vision.

**Shipped:**

- ✅ Complete redesign of all customer-facing pages to match `vibesafe-demo.html`
- ✅ Design system in `globals.css` — type scale, spacing scale, radii, tokens for dark + light themes
- ✅ No-flash theme initialization (inline script reads localStorage before paint)
- ✅ Mobile-first responsive across every page; 44px minimum touch targets
- ✅ Mobile hamburger nav with body-scroll lock, ESC-close, route-change auto-close
- ✅ Light-mode parity (`--nav-bg`, surface, text tokens all adapt)
- ✅ Landing page sections — hero, tools strip, how it works, stats, features, comparison table, testimonials, Chrome extension promo, FAQ, final CTA
- ✅ Pricing page with checkout modal overlay (in-page summary before Stripe redirect)
- ✅ Dashboard shell (table view + mobile card swap) — mock data
- ✅ Login page (GitHub + Google OAuth + credentials)
- ✅ Verify page (DNS + meta tag, technical view + guided platform walkthrough with method switching)
- ✅ Active test page (5-step flow shell with progress simulation)
- ✅ Report page enhancements — animated grade ring, severity filter pills with counts, Active Testing CTA banner
- ✅ Scan progress page — gradient progress bar, elapsed/ETA timer, rotating security facts
- ✅ `/docs` page with 7-section sidebar nav (scroll-spy, mobile horizontal scroll)
- ✅ Footer + sitemap + robots.ts
- ✅ JSON-LD structured data (Organization, WebSite, SoftwareApplication, FAQPage, Product)
- ✅ Per-route metadata + Open Graph + Twitter cards
- ✅ Semantic HTML throughout (main, section, article, header, aside, figure, blockquote, details/summary)
- ✅ `HARDCODED.md` contract written
- ✅ Sign-in icon + entry point in nav (always visible)

**Exit checklist:** all boxes above ✅. Closed.

---

## Phase 2 — Wire real backend (kill `HARDCODED.md`)

**Goal:** Every mocked surface in the UI talks to a real API. The HARDCODED.md file is deleted at the end of this phase.

**Estimated effort:** 2–3 weeks

### 2.1 Dashboard

- [ ] `GET /api/v1/dashboard/stats` returning `{ totalScans, criticalIssues, avgGrade, monitoredSites, trends }`
- [ ] `GET /api/v1/scans?cursor=&limit=` returning paginated user scan history
- [ ] Replace `STATS` array in `src/app/dashboard/page.tsx`
- [ ] Replace `SCANS` array in `src/app/dashboard/page.tsx`
- [ ] Loading skeleton states for both
- [ ] Empty states ("No scans yet — paste a URL on the homepage")
- [ ] Error states (toast + retry)
- [ ] Convert dashboard page from server to mixed (server shell + client data fetch) OR use server-side fetch with cookies

### 2.2 Verify page

- [ ] `POST /api/v1/verify/init` body `{ domain }` returning `{ token, expires_at }`
- [ ] `POST /api/v1/verify/check` body `{ domain, method }` returning `{ verified: bool, detected_value?, expected_value }`
- [ ] Replace hardcoded `domain="taskflow.app"` and `token="vibesafe-verify=…"` with values from URL search params or initiated session
- [ ] Real DNS lookup (TXT query) + real meta tag fetch from `/` of domain
- [ ] Persist verification state to user account so it's remembered across sessions
- [ ] Rate-limit `/check` to prevent abuse (e.g. 1/sec per user, 10/min per domain)

### 2.3 Active test flow

- [ ] `POST /api/v1/active-test/start` body `{ domain, tests: string[] }` returning `{ scan_id, estimated_seconds }`
- [ ] `GET /api/v1/active-test/:id/progress` Server-Sent Events stream emitting `probe_started`, `probe_complete`, `finding`, `scan_complete`
- [ ] `GET /api/v1/active-test/:id/results` returning `{ findings: [...], passed: [...], summary }`
- [ ] Replace `CONFIRMED_FINDINGS` and `PASSED` arrays with real data
- [ ] Replace hardcoded `domain="taskflow.app"` with controlled input value
- [ ] Replace 1.8s simulated step progression with real SSE listener
- [ ] Credit deduction integration (3 credits per run, error if insufficient)
- [ ] Idempotency key on `/start` to prevent double-billing on retries

### 2.4 Scan progress page (passive)

- [ ] **Sync progress bar to actual backend scan duration** — currently the mock interval (340ms × 15 modules ≈ 5s) finishes faster than real scans, so the bar completes and the user waits. Fix: drive progress entirely from real SSE `module_complete` events; show indeterminate shimmer (not 100%) if backend is still working
- [ ] Verify the existing `openScanStream` correctly handles real SSE events from `/api/v1/scans/:id/stream`
- [ ] Add timeout handling — if no event for 30s, show "still working…" with retry CTA
- [ ] Show "this is taking longer than usual" message after ETA elapses without completion
- [ ] On real scan failure, navigate to error state instead of redirecting to home

### 2.5 Report page

- [ ] `GET /api/v1/scans/:id` returning full `ScanData` (grade, score, summary, findings, performanceData, accessibilityData, seoData)
- [ ] Verify existing `/api/v1/scans/:id/findings` endpoint with tier gating works against real data
- [ ] Replace any remaining demo fixtures in `/report/demo` (or keep `/report/demo` as a deliberately static showcase route — decide explicitly)
- [ ] PDF export uses real scan data

### 2.6 Landing page

- [ ] `GET /api/v1/stats/scan-count` returning `{ count, last_updated }`
- [ ] Replace static "scans run" counter starting number
- [ ] Cache response server-side for 60s to avoid hammering DB

### 2.7 Auth wiring

- [ ] Verify `NEXT_PUBLIC_AUTH_ENABLED=true` works end-to-end (GitHub OAuth, Google OAuth, credentials)
- [ ] Session shows user email + sign-out in nav (already coded; needs env flag verified in production)
- [ ] Protected routes (`/dashboard`, `/verify`, `/active-test`) redirect to `/login?next=…` when unauthenticated
- [ ] Post-login redirect honors `next` query param

### 2.8 Payment wiring

- [ ] Verify `/api/v1/checkout` returns valid Stripe Checkout session URLs for each tier (`one-shot`, `pro`, `studio`)
- [ ] Webhook handler updates user tier on `checkout.session.completed`
- [ ] Webhook handler updates user tier on `customer.subscription.updated` / `.deleted`
- [ ] Customer portal link for managing subscriptions
- [ ] Pricing table on dashboard for upgrade prompts

### 2.9 Observability for Phase 2 work

- [ ] Sentry error tracking enabled on all new API routes
- [ ] Request logs include `user_id`, `scan_id`, `route`, `duration_ms`
- [ ] Per-route p50/p95/p99 latency dashboards
- [ ] Slow-query alerts (>1s on hot paths)

### Exit checklist for Phase 2

- [ ] `HARDCODED.md` is deleted (every entry replaced)
- [ ] Manual smoke test of every flow end-to-end signed off
- [ ] No `console.error` or unhandled rejections in browser DevTools across all flows
- [ ] All API routes have rate limiting + auth checks
- [ ] Sentry shows zero error spikes for 48h after deploy
- [ ] Updated copy in `/docs` matches actual API shapes

---

## Phase 3 — Review & harden existing scan modules

**Goal:** Audit what we already check, fix what's wrong, fill obvious gaps. **No new product surface added in this phase.** The output is confidence that "VibeSafe says your site is a B" is something we'd defend in front of a security engineer.

**Estimated effort:** 2–3 weeks

### 3.1 Build a scan-quality test corpus

- [ ] Curate 30+ real sites covering A/B/C/D/F grade distribution
- [ ] Include AI-built sites (Lovable, Bolt, v0, Replit, Cursor outputs)
- [ ] Include known-bad fixtures (deliberately broken `.env.example` exposure, missing headers, etc.)
- [ ] Include known-good fixtures (security-hardened reference sites)
- [ ] Lock baseline expected output per fixture; track drift over time
- [ ] CI job that runs the corpus on every backend PR

### 3.2 False-positive audit (per module)

For each of the 15 security modules + performance/a11y/SEO modules:

- [ ] Run against the corpus
- [ ] Manually classify each finding: true positive / false positive / unclear
- [ ] Calculate per-module FP rate; target <5%
- [ ] For modules >5%: tighten heuristics or remove the finding
- [ ] Document the FP rate per module in `docs/core/MODULE_QUALITY.md`

**Specific known concerns to investigate:**

- [ ] P1-01 (Client-side secrets) — current regex may match non-secret strings (e.g. base64 in image URLs)
- [ ] P1-03 (Security headers) — does it correctly handle CDN-injected headers vs origin headers?
- [ ] P1-07 (CORS) — false positive risk on intentionally permissive APIs
- [ ] P1-09 (Third-party scripts) — does it distinguish first-party vs third-party correctly?
- [ ] P1-12 (Error disclosure) — common FP from intentional 404 / debug routes

### 3.3 Coverage gap audit

What we should be checking but aren't:

- [ ] Subresource integrity (SRI) on external scripts
- [ ] Permissions Policy / Feature Policy headers
- [ ] Referrer-Policy header
- [ ] Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy
- [ ] CSP `unsafe-inline` / `unsafe-eval` detection (depth check, not just presence of CSP)
- [ ] Service worker security (scope, fetch handlers)
- [ ] Web app manifest exposure
- [ ] `.git/`, `.svn/`, `.DS_Store` exposure (likely covered by P1-06 — verify depth)
- [ ] `package.json`, `composer.json`, `Gemfile.lock` exposure
- [ ] Common backup file extensions (`.bak`, `.old`, `.swp`)
- [ ] Storybook / Swagger / GraphiQL exposure in prod
- [ ] AI-builder-specific leaks: Lovable preview tokens, Bolt project IDs, v0 generation IDs in URLs

### 3.4 Finding-copy review

- [ ] Every finding has a one-sentence "what" (the problem)
- [ ] Every finding has a one-sentence "why" (the impact in plain English)
- [ ] Every finding has a verified working fix prompt for at least Cursor + ChatGPT
- [ ] Severity levels follow a documented rubric (not vibes)
- [ ] No jargon without inline explanation
- [ ] No findings that recommend installing third-party services as the only fix

### 3.5 SEO module review + AI discoverability bundle

Treat as one combined "SEO & AI discoverability" audit category (no separate GEO selling point):

- [ ] Existing SEO checks reviewed for FP rate + relevance
- [ ] Add `llms.txt` presence check
- [ ] Add AI-crawler robots policy detection (`User-agent: GPTBot`, `ClaudeBot`, `PerplexityBot`, etc. — whether explicitly allowed or blocked)
- [ ] Add citable-stats check (numbers in copy with source attribution)
- [ ] Add TLDR/summary section detection on long-form pages
- [ ] Add table/list density check on key landing pages
- [ ] **Do not add a separate score or category.** Bundle into existing SEO score, mention "includes AI search optimization" in copy.

### 3.6 Performance module review

- [ ] Are Core Web Vitals measured from real user data or synthetic? Document.
- [ ] Lighthouse score consistency — same site, same time should produce same score within ±3 points
- [ ] Mobile vs desktop scoring documented separately

### 3.7 Accessibility module review

- [ ] WCAG 2.2 AA coverage map — which criteria do we check, which do we miss?
- [ ] Reduce false positives on contrast checks (gradient backgrounds, decorative text)
- [ ] Form-label heuristic accuracy

### 3.8 Update reporting copy

- [ ] Executive summary (`execSummary` in `report-view.tsx`) reflects audited reality
- [ ] Comparison table on landing page reflects verified module count + accuracy claims
- [ ] FAQ entries on landing + `/docs` are accurate

### 3.9 Apply learnings from Phase 2 wiring

- [ ] Address every "this module's output is weird" observation captured during Phase 2 backend wiring
- [ ] Triage backlog of module-quality issues from production telemetry (once we have it)

### Exit checklist for Phase 3

- [ ] Every module has documented FP rate in `MODULE_QUALITY.md`
- [ ] No module exceeds 5% FP rate (or has an acknowledged exception with reason)
- [ ] Scan corpus runs cleanly in CI
- [ ] Every finding has reviewed copy + working AI fix prompt
- [ ] SEO module includes the AI-discoverability sub-checks
- [ ] At least one external security engineer has spot-reviewed 10 scans and signed off

---

## Phase 4 — Active testing build-out (the real DAST)

**Goal:** Replace the simulated active-test flow with a real DAST engine. The UI shell is already built (Phase 1); this phase ships the engine behind it.

**Estimated effort:** 4–6 weeks

### 4.1 Engine foundation

- [ ] Headless browser pool (Playwright) on isolated workers
- [ ] Rate limiter enforcing ≤2 req/s per target domain
- [ ] Fixed source IP block (so customers can allowlist)
- [ ] CFAA-compliance checks before every scan (verify ownership token is fresh ≤7 days)
- [ ] Per-scan resource caps (CPU, RAM, bandwidth, runtime)
- [ ] Kill switch — domain owner can abort an in-flight test

### 4.2 Probe modules (v1)

- [ ] SQL injection — error-based, time-based blind, boolean-based
- [ ] Stored + reflected XSS
- [ ] Auth bypass — JWT none-alg, missing signature verification, predictable tokens
- [ ] CORS exploit confirmation (not just header check — actual cross-origin POC)
- [ ] Open redirect exploitation
- [ ] CSRF on state-changing endpoints
- [ ] IDOR / BOLA on numeric IDs
- [ ] SSRF on URL-input fields

### 4.3 Proof-of-exploit capture

- [ ] Every CONFIRMED finding captures: request, response, exploit payload, screenshot
- [ ] Replayable as a curl one-liner
- [ ] Stored encrypted at rest (AES-256), deleted after 90 days (free) / 365 days (paid)

### 4.4 Safety

- [ ] Never test logout endpoints
- [ ] Never submit forms that mutate billing / payment / DELETE endpoints
- [ ] Detect "production-looking" data in responses → abort
- [ ] Honor `noindex`, `noscan` meta tags as opt-out

### 4.5 Pricing & billing

- [ ] 3 credits per scan, billed atomically
- [ ] Failed scans (engine error, not finding) refund credits
- [ ] Tier-gated test types (e.g. SSRF + IDOR are Pro+)

### Exit checklist for Phase 4

- [ ] All probe modules have 0% false-positive rate on the corpus (only confirmed exploits)
- [ ] Pen-tested against staging environment by external red-team (or competent internal)
- [ ] Documented runbook for handling "scan caused a production incident"
- [ ] Legal review of CFAA compliance flow signed off

---

## Phase 5 — Chrome Extension Beta

**Goal:** Ship the extension promised by the landing page promo section.

**Estimated effort:** 3–4 weeks

- [ ] Manifest V3 extension scaffold
- [ ] Live grade badge on every visited site (lightweight passive check)
- [ ] Right-click → "Scan this page with VibeSafe"
- [ ] Real-time secret detection in network requests
- [ ] One-click deep-scan handoff to full web flow
- [ ] Chrome Web Store listing (screenshots, demo video, privacy policy)
- [ ] Beta waitlist drip — invite the first 100 waitlist signups
- [ ] Telemetry: scans per user, badge clicks, deep-scan handoffs

### Exit checklist for Phase 5

- [ ] Published on Chrome Web Store, public installable
- [ ] Privacy policy explicitly covers extension data handling
- [ ] 50+ active installs from waitlist
- [ ] Crash-free rate >99.5% (Sentry)

---

## Phase 6 — Public API, Webhooks & CI/CD

**Goal:** Make every dashboard action available programmatically. Ship the GitHub Action that the docs already describe.

**Estimated effort:** 3–4 weeks

- [ ] Token-based API auth (`vs_live_…`)
- [ ] Per-user API key management UI
- [ ] All endpoints documented in `/docs` match real shapes (already drafted; needs verification)
- [ ] Rate limits per tier
- [ ] Webhook signing (HMAC-SHA256, `signature` header)
- [ ] Webhook delivery retries with exponential backoff, dead-letter queue
- [ ] Webhook event types: `scan.started`, `scan.completed`, `scan.failed`, `finding.critical`
- [ ] GitHub Action: `vibesafe/scan-action@v1`
- [ ] CLI: `npx @vibesafe/cli scan --url … --fail-on critical`
- [ ] CI policy: configurable fail thresholds per branch / per environment

### Exit checklist for Phase 6

- [ ] Public API docs match shipped implementation
- [ ] GitHub Action published in Marketplace
- [ ] At least 3 dogfood integrations live (our own repos)
- [ ] Webhook delivery success rate >99% over 7 days

---

## Phase 7 — Team & enterprise foundations

**Goal:** Multi-user workspaces, RBAC, SSO. Unlocks Studio tier renewal + enterprise sales.

**Estimated effort:** 4–6 weeks

- [ ] Team / workspace data model
- [ ] Roles: Owner, Admin, Member, Read-only
- [ ] Invite flow (email + role)
- [ ] SSO (SAML, then Okta / Azure AD via OIDC)
- [ ] Audit log of sensitive actions (member added, scan deleted, billing changed)
- [ ] Per-finding assignment + status (open / acknowledged / fixed / wontfix)
- [ ] Slack notifications on `scan.completed` and `finding.critical`
- [ ] SCIM provisioning (deferred unless first enterprise deal demands it)

### Exit checklist for Phase 7

- [ ] First paying team customer migrated to team workspace
- [ ] SSO works with at least 2 IdPs end-to-end
- [ ] Audit log retains 1y minimum

---

## Phase 8 — Internationalization (gated)

**Goal:** Support non-English markets *if data justifies it.* Not assumed; not committed to.

**Gate condition:** ≥15% of traffic from non-EN locales for 30 consecutive days, OR a signed enterprise contract requiring localization.

**If gate is met:**

- [ ] Adopt `next-intl` (preferred) or `next-i18next`
- [ ] Extract all UI copy to message files
- [ ] Language picker in nav (persisted to localStorage + cookie)
- [ ] Locale-aware date / number / currency formatting
- [ ] Translated metadata + Open Graph per locale
- [ ] `hreflang` tags + per-locale sitemaps
- [ ] Translate priority pages first: landing, pricing, /docs, /report
- [ ] Translate findings copy + AI fix prompts (significant LLM cost; budget separately)
- [ ] Locale-specific legal pages (GDPR for EU, etc. already drafted)

**Initial language priority** (driven by traffic data, not assumption):

1. Whichever top non-EN locale appears in analytics
2. Then the next one
3. No speculative translation

### Exit checklist for Phase 8 (when triggered)

- [ ] Landing + pricing + docs available in at least 1 non-EN locale
- [ ] All metadata + JSON-LD localized
- [ ] Translation memory exported for future updates

---

## Phase 9 — Scan diffing & monitoring

**Goal:** Turn one-off scans into continuous monitoring.

**Estimated effort:** 2–3 weeks

- [ ] Scheduled scans (daily / weekly / on-deploy)
- [ ] Diff view: this scan vs last scan (new findings, resolved findings, regressions)
- [ ] Email digest of changes
- [ ] PR comment with diff (when paired with GitHub Action)
- [ ] Grade trend chart on dashboard
- [ ] Slack alert on regression

---

## Phase 10 — Performance & cost optimization

**Goal:** Sustain growth without proportional infra cost increase.

- [ ] Edge caching of scan results for public reports
- [ ] Reduce avg scan time from ~75s to <30s
- [ ] Anthropic API cost <$0.001 per scan (down from $0.002 target)
- [ ] Database query audit (no N+1s, all hot paths indexed)
- [ ] CDN-aware report rendering
- [ ] PDF generation moved to async queue (currently synchronous)

---

## Phase 11+ — Future / speculative

Held until earlier phases prove out. Listed for visibility only — not committed.

- Mobile app (iOS / Android) — only after web product-market-fit confirmed
- Self-hosted enterprise option (Docker + Helm chart)
- Visual regression testing
- AI-powered auto-fix that generates PRs
- SaaS factory product #2 (SpeedCheck)
- White-label licensing

---

## Cross-cutting concerns (every phase)

These are not phase-specific; they're baseline expectations applied throughout.

- **Security:** every new endpoint goes through auth + input validation + rate limiting before merge
- **Accessibility:** every new UI surface meets WCAG 2.2 AA; tested with keyboard-only + screen reader
- **Mobile:** every new UI surface passes a 375px-width smoke test
- **Theme:** every new UI surface works in both dark and light mode
- **Telemetry:** every new feature emits enough events to measure adoption + errors
- **Docs:** every new public surface is documented in `/docs` *in the same PR*
- **Legal:** every data-handling change goes through privacy policy review

---

## Phase status board

| Phase | Status | Started | Target close |
|-------|--------|---------|--------------|
| 1. Frontend redesign + SEO | ✅ Done | 2026-05-01 | 2026-05-13 |
| 2. Wire backend / kill mocks | 🚧 Next | — | TBD |
| 3. Review & harden modules | ⏳ Queued | — | — |
| 4. Active testing engine | ⏳ Queued | — | — |
| 5. Chrome extension beta | ⏳ Queued | — | — |
| 6. API, webhooks, CI/CD | ⏳ Queued | — | — |
| 7. Team & enterprise | ⏳ Queued | — | — |
| 8. i18n (gated) | 🚫 Blocked on traffic data | — | — |
| 9. Scan diffing & monitoring | ⏳ Queued | — | — |
| 10. Performance & cost | ⏳ Queued | — | — |

---

**Document owner:** Engineering
**Review cadence:** Update the status board at the end of every phase; review the queue order whenever priorities shift.
**Cross-reference:** `HARDCODED.md` (the Phase 2 contract), `PHASES.md` (product/business narrative).
