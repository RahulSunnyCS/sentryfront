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
4. **Review before adding.** Phase 3 (review scan modules) and Phase 4 (review AI enrichment) both run *before* Phase 5 (new product surface like active testing). We do not bolt new features onto unaudited foundations.

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

## Phase 2.5 — Truth-in-marketing audit (overclaiming review)

**Goal:** Every public-facing claim — README, landing page, `/docs`, vision docs, comparison tables, social copy — accurately reflects what the code actually does today. No aspirational features described in the present tense. No regulatory/legal terminology that the implementation can't defend. Either bring the code up to the claim or bring the claim down to the code.

**Why now:** A skeptical reviewer (security engineer, accessibility consultant, compliance lawyer, due-diligence analyst) who reads our docs and then `git clone`s the repo should find no gap. Right now there are several. Until this is fixed, the docs are a liability — they downgrade trust in the rest of the work the moment a single overclaim is spotted.

**Estimated effort:** 1 week (mostly copy + audit, minor code changes)

**Operating rule:** No new marketing-facing copy ships during this phase. Patches and bug fixes are fine; net-new claims are not.

### 2.5.1 Accessibility claims vs. implementation

- [ ] `README.md:21` reads "WCAG 2.2 Level AA — Legal compliance checking." Audit what is actually checked: `src/lib/scanner/modules/accessibility.ts` orchestrates `p3-01` through `p3-05` which parse Lighthouse's accessibility audits. No `@axe-core/*` package is in `package.json`. Either:
  - [ ] Add real `@axe-core/playwright` (or similar) integration and document which WCAG 2.2 AA criteria are actually evaluated, OR
  - [ ] Rewrite README + landing copy to: "Accessibility checks via Lighthouse's accessibility audit (subset of WCAG 2.2 AA)" — no "compliance" / "legal" language without an attestation pipeline behind it
- [ ] Remove "axe-core" references from `docs/core/TDD.md` and `src/lib/scanner/modules/accessibility.ts` comments unless axe-core is actually wired
- [ ] Map every accessibility finding back to a specific WCAG SC number; publish the coverage map in `docs/core/WCAG_COVERAGE.md` (which we'd commit to maintaining as we add/remove checks)

### 2.5.2 Compliance claims vs. implementation

- [ ] `COMPLIANCE_VISION_SUMMARY.md` lists P5-01 through P5-08 (GDPR, CCPA, PCI-DSS, HIPAA) as documented modules with implementation roadmap. Zero `p5-*.ts` files exist in `src/lib/scanner/modules/`. Either:
  - [ ] Move the entire compliance module section into `docs/specs/COMPLIANCE_FUTURE.md` clearly labeled "Future / Not Implemented", OR
  - [ ] Drop compliance from the "5 pillars" framing in `docs/VISION.md`, `docs/VISION_SUMMARY.md`, and any landing/marketing copy until at least one P5 module ships
- [ ] Remove "Compliance protects your business. GDPR, WCAG, CCPA—we check them all" from `docs/VISION.md` and any place it's used as marketing copy
- [ ] Remove every "✅" marker from `COMPLIANCE_VISION_SUMMARY.md` that's adjacent to an unimplemented module
- [ ] Any GDPR / CCPA / HIPAA / PCI-DSS mention on any user-facing page must link to a docs page that names the specific checks performed — or be removed
- [ ] Legal review: confirm we are not implying regulatory attestation we can't deliver

### 2.5.3 Security feature claims vs. implementation

- [ ] `README.md:124` lists "Dependency Vulnerabilities (npm audit)" as a security module. There is no npm-audit integration in `src/lib/scanner/`. Either:
  - [ ] Add a real dependency-vuln check (integrate npm audit / OSV.dev / GitHub Advisory) as P1-XX, OR
  - [ ] Remove the line from the README and from any module list that implies it ships today
- [ ] Verify every other line in `README.md` "What's Included" against `src/lib/scanner/modules/`:
  - [ ] "Known Vulnerabilities (Nuclei)" — is `src/lib/scanner/tools/nuclei.ts` actually integrated end-to-end, or is it a stub like the gitleaks fallback?
  - [ ] "Subdomain Enumeration" — does `subfinder.ts` actually run in production deploys, or is it dev-only?
  - [ ] "WAF Detection" / "CDN Detection" — point to the modules that implement these or remove
  - [ ] "Outdated Software Detection" — point to the module or remove
- [ ] Every README bullet must map to a specific module file. Anything that can't be mapped gets cut.

### 2.5.4 AI claims vs. implementation

- [ ] `README.md:13` says "AI-Powered Enrichment - Claude explains findings in plain English." Acceptable claim — but audit for stronger language elsewhere:
  - [ ] Remove or downgrade any copy that implies AI is doing detection (the AI only rewords deterministic findings; the prompt explicitly forbids invention)
  - [ ] Landing page, social copy, and `/docs` describe the AI layer as "explanation + fix-prompt generation," not "AI-powered scanning"
- [ ] When the eval harness from Phase 4.1 doesn't yet exist, do not publish hallucination-rate, accuracy-rate, or "X% precision" claims anywhere

### 2.5.5 Scale & performance claims

- [ ] `docs/core/TDD.md` §10.1 claims "10,000 scans/day, 1,000 concurrent users" capacity. There is no load test backing this. Either:
  - [ ] Run a real load test (Phase 12 has this scoped) and publish the measured ceiling, OR
  - [ ] Reword to "design target" not "current capacity"
- [ ] `docs/core/TDD.md` §13.3 cost projection table and `PRD.md` §2.1 "Year 1 business goals" with MRR/customer targets do not belong in a technical design doc shown to engineering reviewers. Either:
  - [ ] Move financial projections to `docs/business/PROJECTIONS.md` (separate from TDD), OR
  - [ ] Strip them and keep TDD purely technical
- [ ] Any "<90 second scan" or "<60 second scan" claim must be backed by measured p95 from real production scans, not aspirational targets

### 2.5.6 Artifact integrity

- [ ] `docs/compliance/sbom.json` is a 158KB `npm ls` dump, not a CycloneDX or SPDX-formatted SBOM. Either:
  - [ ] Generate a real CycloneDX SBOM with `@cyclonedx/cyclonedx-npm` and commit that, OR
  - [ ] Rename the file to `dependency-tree.json` and remove the word "SBOM" from any reference to it
- [ ] `verify-domain.html` and `vibesafe-demo.html` (4,385 lines) are standalone HTML mockups checked into the repo root. Decide: are these reference designs (move to `/design/` or `/mockups/` with a README explaining they're not shipped code), or stale and removable?

### 2.5.7 Roadmap honesty in user-facing surfaces

- [ ] Landing page "Chrome extension" promo section: either link to a real waitlist with a "not yet released" disclaimer, or remove until Phase 6 ships
- [ ] Landing page comparison table (`docs/VISION.md` §"vs. Traditional Security Scanners"): every ✅ in the VibeSafe column must map to shipped code, not roadmap. Move any roadmap items to "coming soon" rows
- [ ] `docs/specs/MARKETING_INTELLIGENCE_SPEC.md`, `docs/specs/FUTURE_FEATURES.md`, `docs/specs/CHROME_EXTENSION_SPEC.md` — confirm each has a clear "STATUS: NOT IMPLEMENTED" banner at the top, not just in the metadata block
- [ ] Audit `/docs` site copy (`src/app/docs/`) for present-tense descriptions of features that don't exist yet

### 2.5.8 Phase 1 ✅ verification

The Phase 1 checklist in this document is marked complete. Before showing this repo to anyone external, verify each ✅ against running code, not against memory:

- [ ] Boot the app cold (`npm install && npm run dev`) and click through every page listed in Phase 1; record any that 404, error, or silently render mock content as a Phase 2 carry-over
- [ ] OAuth login (GitHub + Google + credentials) actually completes a session end-to-end in dev, not just renders a button
- [ ] Theme toggle, mobile nav close-on-route-change, ESC-close, scroll-spy — manually validated
- [ ] Any ✅ that is partially true gets demoted to 🚧 with a one-line note

### 2.5.9 Public-claim style guide

- [ ] Write `docs/core/CLAIMS_RULES.md` — one page covering:
  - [ ] Never use "compliance" / "compliant" / "attestation" without a documented attestation process behind it
  - [ ] Never use "AI-powered" for deterministic logic with an AI cosmetic layer
  - [ ] Never use regulatory terms (GDPR / WCAG / HIPAA / PCI-DSS / SOC 2) in copy unless we can defend the specific checks
  - [ ] Capacity / performance numbers cite measured data or are labeled "design target"
  - [ ] Every "what we check" bullet maps to a specific module file
- [ ] PR review checklist updated to include "no new public-facing claims introduced without a code reference"

### Exit checklist for Phase 2.5

- [ ] Every claim in `README.md` maps to a specific file in `src/lib/scanner/modules/` or `src/lib/llm/` (no orphans)
- [ ] Every ✅ in `docs/VISION.md`, `COMPLIANCE_VISION_SUMMARY.md`, and the Phase 1 section of this doc reflects shipped, runnable code
- [ ] No "compliance" / "attestation" / regulatory-acronym language anywhere user-facing without a backing module
- [ ] `CLAIMS_RULES.md` written and referenced from the PR template
- [ ] One external reviewer (not the project owner) reads `README.md` + landing + `/docs`, then `git clone`s and tries each claim; their gap list is empty
- [ ] `docs/compliance/sbom.json` either replaced with a real SBOM or renamed

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

### 3.10 Per-module fixture unit tests

Distinct from the end-to-end corpus in 3.1 — these are small, fast, deterministic input → expected-output pairs that run on every PR in milliseconds. The corpus catches real-world integration drift; fixtures catch regressions in module logic.

- [ ] Test harness: `tests/fixtures/<module-id>/<case-name>.{input,expected}.{html,json,headers}`
- [ ] Each fixture pairs raw input (HTML snippet, response headers, JS bundle excerpt, robots.txt content, etc.) with expected output (`{ finding: bool, severity?, type?, evidence? }`)
- [ ] Snapshot-style comparison — failed snapshots block CI
- [ ] Per-module minimum coverage:
  - [ ] At least 3 positive cases (should flag)
  - [ ] At least 3 negative cases (should NOT flag — classic false-positive traps)
  - [ ] At least 1 edge case (malformed input, empty input, very large input)
- [ ] **Every bug report becomes a new fixture** (regression test forever)
- [ ] Fixture authoring guide in `docs/core/FIXTURE_GUIDE.md` so contributors can add cases consistently
- [ ] CI job: `pnpm test:fixtures` runs in <30s

**Example fixture pairs to seed:**

- P1-01 (Secrets): real AWS key string (flag) vs base64-encoded image URL (don't flag) vs example `.env.example` placeholder (don't flag)
- P1-03 (Headers): CSP with `unsafe-inline` (flag medium) vs strict CSP (don't flag) vs missing CSP entirely (flag high)
- P1-07 (CORS): `Access-Control-Allow-Origin: *` on private API (flag) vs same header on intentional public API (don't flag — needs heuristic for "intentional")
- P1-12 (Error disclosure): stack trace in 500 response (flag) vs custom 404 page (don't flag) vs Next.js dev overlay (flag, dev-only warning)

### Exit checklist for Phase 3

- [ ] Every module has documented FP rate in `MODULE_QUALITY.md`
- [ ] No module exceeds 5% FP rate (or has an acknowledged exception with reason)
- [ ] Scan corpus runs cleanly in CI
- [ ] Every module has ≥3 positive + ≥3 negative + ≥1 edge-case fixture; all green in CI
- [ ] Every finding has reviewed copy + working AI fix prompt
- [ ] SEO module includes the AI-discoverability sub-checks
- [ ] At least one external security engineer has spot-reviewed 10 scans and signed off

---

## Phase 4 — AI enrichment review & strengthen

**Goal:** Audit and harden the LLM layer that produces finding explanations, business-impact narratives, and AI fix prompts. "AI is integrated" is not "AI is accurate, cheap, fast, and non-hallucinating." This phase makes the enrichment layer something we'd stake the product reputation on.

**Estimated effort:** 2–3 weeks

### 4.1 Eval harness

- [ ] Golden test set: 50+ findings across module/severity/AI-tool combinations with hand-graded ideal output
- [ ] Automated eval scoring per output: explanation clarity, technical accuracy, fix prompt usability, hallucination presence
- [ ] CI job that runs the eval set on every prompt change and blocks regressions
- [ ] Regression dashboard: explanation quality / fix prompt quality / hallucination rate over time
- [ ] Eval results published to `docs/core/AI_QUALITY.md`

### 4.2 Hallucination audit

- [ ] Spot-check 100 production findings: does the AI invent file paths, line numbers, function names, or library versions that don't exist in the source?
- [ ] Add grounding: prompts must cite the exact evidence snippet the finding is based on
- [ ] Output validator: regex / structural check that every claimed file path / URL / header name actually appeared in the scan input
- [ ] If validator fails → fallback to a deterministic template (no AI for that finding)

### 4.3 Prompt quality review

- [ ] Re-read every prompt in the codebase (`/lib/ai/prompts/*` or wherever they live)
- [ ] Each finding has prompts for: explanation, business-impact, fix-prompt (per AI tool)
- [ ] System prompts include explicit "do not invent details" + "cite evidence" rules
- [ ] Few-shot examples updated to current Claude best practices
- [ ] Standardized output schema (JSON mode) — eliminates parsing fragility
- [ ] A/B test old vs new prompts on the eval set; only ship the winner

### 4.4 Cost & latency audit

- [ ] Measure actual cost per scan (claim is <$0.002 — verify)
- [ ] Token usage breakdown: explanation vs business-impact vs fix-prompts
- [ ] Identify which findings drive cost (long evidence blobs? verbose prompts?)
- [ ] Implement prompt caching for stable system prompts (Anthropic prompt caching API)
- [ ] Response caching: same finding type + same evidence hash → return cached enrichment (skip LLM)
- [ ] Cost dashboard: $/scan, $/user/month, projected $/month at next 10× traffic
- [ ] Hard cap: alert if any single scan exceeds $0.05 enrichment cost

### 4.5 Model selection review

- [ ] Document which Claude model each enrichment task uses today
- [ ] Per-task evaluation: does this task need Sonnet, or is Haiku sufficient?
- [ ] Move cheap tasks (severity normalization, copy formatting) to Haiku
- [ ] Reserve Sonnet for high-judgment tasks (fix prompt synthesis)
- [ ] Reserve Opus for nothing (cost-prohibitive at current pricing) unless eval proves uplift

### 4.6 Fix-prompt tailoring per AI tool

- [ ] Audit the prompts shipped for each: Cursor, Lovable, Bolt, v0, Replit Agent
- [ ] Each tool has tool-specific conventions (Cursor `⌘K` context, Lovable chat panel format, etc.)
- [ ] Validate fix prompts produce working fixes — paste 20 sampled prompts into each tool, verify the generated change compiles + fixes the finding
- [ ] Track per-tool success rate

### 4.7 Failure modes & fallbacks

- [ ] Anthropic API down → fallback to templated explanations (no AI)
- [ ] Rate limit hit → queue + retry with exponential backoff
- [ ] Timeout > 10s → return what we have, mark as "AI enrichment pending"
- [ ] Malformed JSON response → retry once, then fallback to template
- [ ] Sentry breadcrumbs for every fallback path

### 4.8 Surface area review

- [ ] Are there places we *should* be using AI but aren't?
  - [ ] AI chat with findings ("explain this further", "show me how to test the fix")
  - [ ] Natural-language scan target ("scan my company site" → resolve URL)
  - [ ] AI-generated executive summary in PDF export
  - [ ] AI-suggested scan policies for repeat customers
- [ ] Are there places we use AI that we shouldn't (deterministic logic dressed up as AI)?

### 4.9 Compliance & data handling

- [ ] Confirm no PII from scanned sites leaks into prompts
- [ ] Verify Anthropic API not used for training (zero-retention agreement / Anthropic's standard policy)
- [ ] Document data flow for privacy policy

### Exit checklist for Phase 4

- [ ] Eval harness green on the golden set
- [ ] Hallucination rate <1% across eval set
- [ ] Cost per scan documented and within target (<$0.002 or new agreed target)
- [ ] All prompts use grounded evidence citations
- [ ] Fix prompt per-tool success rate ≥80% on sampled test
- [ ] `AI_QUALITY.md` published with measured metrics
- [ ] Fallback paths tested by killing the Anthropic API in staging

---

## Phase 5 — Active testing build-out (the real DAST)

**Goal:** Replace the simulated active-test flow with a real DAST engine. The UI shell is already built (Phase 1); this phase ships the engine behind it.

**Estimated effort:** 4–6 weeks

### 5.1 Engine foundation

- [ ] Headless browser pool (Playwright) on isolated workers
- [ ] Rate limiter enforcing ≤2 req/s per target domain
- [ ] Fixed source IP block (so customers can allowlist)
- [ ] CFAA-compliance checks before every scan (verify ownership token is fresh ≤7 days)
- [ ] Per-scan resource caps (CPU, RAM, bandwidth, runtime)
- [ ] Kill switch — domain owner can abort an in-flight test

### 5.2 Probe modules (v1)

- [ ] SQL injection — error-based, time-based blind, boolean-based
- [ ] Stored + reflected XSS
- [ ] Auth bypass — JWT none-alg, missing signature verification, predictable tokens
- [ ] CORS exploit confirmation (not just header check — actual cross-origin POC)
- [ ] Open redirect exploitation
- [ ] CSRF on state-changing endpoints
- [ ] IDOR / BOLA on numeric IDs
- [ ] SSRF on URL-input fields

### 5.3 Proof-of-exploit capture

- [ ] Every CONFIRMED finding captures: request, response, exploit payload, screenshot
- [ ] Replayable as a curl one-liner
- [ ] Stored encrypted at rest (AES-256), deleted after 90 days (free) / 365 days (paid)

### 5.4 Safety

- [ ] Never test logout endpoints
- [ ] Never submit forms that mutate billing / payment / DELETE endpoints
- [ ] Detect "production-looking" data in responses → abort
- [ ] Honor `noindex`, `noscan` meta tags as opt-out

### 5.5 Pricing & billing

- [ ] 3 credits per scan, billed atomically
- [ ] Failed scans (engine error, not finding) refund credits
- [ ] Tier-gated test types (e.g. SSRF + IDOR are Pro+)

### Exit checklist for Phase 5

- [ ] All probe modules have 0% false-positive rate on the corpus (only confirmed exploits)
- [ ] Pen-tested against staging environment by external red-team (or competent internal)
- [ ] Documented runbook for handling "scan caused a production incident"
- [ ] Legal review of CFAA compliance flow signed off

---

## Phase 6 — Chrome Extension Beta

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

### Exit checklist for Phase 6

- [ ] Published on Chrome Web Store, public installable
- [ ] Privacy policy explicitly covers extension data handling
- [ ] 50+ active installs from waitlist
- [ ] Crash-free rate >99.5% (Sentry)

---

## Phase 7 — Public API & Webhooks

**Goal:** Make every dashboard action available programmatically. Ship a stable, documented API that users can build integrations on top of.

**Estimated effort:** 3–4 weeks

- [ ] Token-based API auth (`vs_live_…`)
- [ ] Per-user API key management UI
- [ ] All endpoints documented in `/docs` match real shapes (already drafted; needs verification)
- [ ] Rate limits per tier
- [ ] Webhook signing (HMAC-SHA256, `signature` header)
- [ ] Webhook delivery retries with exponential backoff, dead-letter queue
- [ ] Webhook event types: `scan.started`, `scan.completed`, `scan.failed`, `finding.critical`

### Exit checklist for Phase 7

- [ ] Public API docs match shipped implementation
- [ ] At least 3 dogfood integrations live (our own services)
- [ ] Webhook delivery success rate >99% over 7 days

---

## Phase 8 — Team & enterprise foundations

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

### Exit checklist for Phase 8

- [ ] First paying team customer migrated to team workspace
- [ ] SSO works with at least 2 IdPs end-to-end
- [ ] Audit log retains 1y minimum

---

## Phase 9 — Internationalization (gated)

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

### Exit checklist for Phase 9 (when triggered)

- [ ] Landing + pricing + docs available in at least 1 non-EN locale
- [ ] All metadata + JSON-LD localized
- [ ] Translation memory exported for future updates

---

## Phase 10 — Scheduled rescans + email alerts

**Goal:** Drive re-engagement by running scans on a schedule and surfacing changes in the user's inbox. "We scanned your site weekly — here's what changed." Costs almost nothing to build, works for free users, no external integrations required.

**Rationale:** This lands earlier than CI/CD or Slack because it requires no user-side setup, reaches users who don't have a DevOps workflow, and puts VibeSafe back in front of users who scanned once and forgot. A weekly email is a low-friction retention loop.

**Estimated effort:** 1–2 weeks

### 10.1 Scan scheduling

- [ ] Data model: `scheduled_scan` table with `{ user_id, domain, frequency: 'daily' | 'weekly' | 'monthly', last_run_at, next_run_at, enabled }`
- [ ] UI: "Monitor this site" toggle on the report page + dashboard; frequency picker (free users: weekly only; Pro: daily; Studio: daily + multiple domains)
- [ ] Cron job (or queue-based) that fires pending scans at the scheduled time
- [ ] Idempotency: if a scan is already in-flight for the same domain + user, skip the scheduled trigger
- [ ] Backfill guard: on first enable, run an immediate scan so the user sees a result before the first scheduled one

### 10.2 Change detection

- [ ] Compare new scan findings against the previous scan for the same domain
- [ ] Classify each finding as: `new` / `resolved` / `persisted` / `regressed` (severity increased)
- [ ] Store diff alongside scan record; expose via `GET /api/v1/scans/:id/diff`
- [ ] Grade delta: show `↑ B→A` or `↓ A→C` in the email and dashboard

### 10.3 Email digest

- [ ] Trigger on every scheduled scan completion
- [ ] Template: grade badge (current), grade delta vs last scan, new critical/high findings (top 3), resolved findings count, CTA to view full report
- [ ] Plain-text fallback for email clients that block HTML
- [ ] One-click unsubscribe link (CAN-SPAM / GDPR compliant)
- [ ] Email provider: Resend (preferred) or Postmark; do NOT use a raw SMTP relay
- [ ] Respect user email preferences (granular: scan alerts separate from marketing)
- [ ] Rate cap: max 1 email per domain per day regardless of how many scans run

### 10.4 Dashboard signal

- [ ] "Last scanned X days ago" label on monitored sites in dashboard
- [ ] Grade trend sparkline (7-point or 30-point) per domain on dashboard card
- [ ] "X new issues since last scan" badge on report entry points

### Exit checklist for Phase 10

- [ ] Scheduled scans fire within 15 minutes of scheduled time under normal load
- [ ] Email delivered within 5 minutes of scan completion; delivery rate >99%
- [ ] Unsubscribe honored within 1 request (no 24h delay)
- [ ] Diff API returns correct `new` / `resolved` / `persisted` / `regressed` classifications on the test corpus
- [ ] No duplicate emails for the same scan event
- [ ] GDPR: user data deletion cascade removes scheduled scans + email history

---

## Phase 11 — Geographic Payment Localization

**Goal:** Unlock India and European markets with regionally appropriate pricing, payment methods, and tax handling. Three regions to start — US, Europe, and India. Covers the majority of addressable market while keeping Stripe config, currency tables, and tax logic tractable. Expand to SE Asia / LATAM in a follow-up phase.

**Estimated effort:** 2–3 weeks

### Phase G1 — Geo Detection

Detect the user's region on every request so downstream logic can branch on it.

- [ ] Server: read `x-vercel-ip-country` header (Vercel sets this automatically) or Cloudflare's `CF-IPCountry`. Fall back to `Accept-Language` browser locale.
- [ ] Define a `Region` type: `'us' | 'eu' | 'in' | 'unknown'`
- [ ] Create `src/lib/geo.ts` — `getRegion(req: NextRequest): Region`
- [ ] Pass region to checkout API and pricing components via a Next.js cookie or a root layout server component that forwards it as a prop.

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

- [ ] Create separate Stripe Price objects in each currency in the Stripe Dashboard.
- [ ] Add env vars per region:
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
- [ ] Update `src/lib/stripe/client.ts` — `STRIPE_PRICES` becomes a map keyed by region.
- [ ] Update `src/components/pricing-card.tsx` — accept `region` prop; display localized price and currency symbol.

---

### Phase G3 — Regional Payment Methods

Use Stripe's **PaymentElement** (replaces the current redirect-to-Checkout approach) so Stripe automatically surfaces the right local payment methods per region.

| Region | Payment Methods |
|--------|----------------|
| US     | Visa/MC/Amex, Apple Pay, Google Pay, ACH Direct Debit |
| Europe | Visa/MC, Apple Pay, Google Pay, SEPA Direct Debit, iDEAL (NL), Bancontact (BE), Klarna |
| India  | UPI (Google Pay, PhonePe, Paytm), Netbanking, Rupay cards |

- [ ] Add `@stripe/stripe-js` and `@stripe/react-stripe-js` to `dependencies`.
- [ ] Create `src/app/checkout/page.tsx` — embedded Stripe PaymentElement flow.
- [ ] Update `/api/v1/checkout/route.ts`:
  - Create a `PaymentIntent` (one-shot) or `SetupIntent` (subscription) instead of a Checkout Session.
  - Pass `automatic_payment_methods: { enabled: true }` — Stripe handles the rest.
  - For India UPI: set `currency: 'inr'` and Stripe will show UPI automatically.
- [ ] For subscriptions (Pro/Studio): use Stripe Billing with `payment_behavior: 'default_incomplete'` and collect payment method via PaymentElement before confirming.
- [ ] EU-specific: enable SEPA Direct Debit in Stripe Dashboard → Payment Methods. iDEAL and Bancontact are enabled automatically for EUR PaymentIntents.
- [ ] India-specific: enable UPI in Stripe Dashboard → Payment Methods → India.

---

### Phase G4 — Tax Compliance

| Region | Tax Type | Stripe Feature |
|--------|----------|----------------|
| US     | Sales tax (state-level) | Stripe Tax — automatic |
| Europe | VAT (20–25% depending on country) | Stripe Tax — automatic + EU VAT ID collection |
| India  | GST (18%) | Stripe Tax — automatic for IN merchants |

- [ ] Enable **Stripe Tax** in the Stripe Dashboard (one-click).
- [ ] Add `automatic_tax: { enabled: true }` to all Checkout Sessions / PaymentIntents.
- [ ] For EU B2B: add `tax_id_collection: { enabled: true }` to collect VAT IDs so reverse-charge applies (0% VAT for verified EU businesses).
- [ ] No code changes needed beyond the two flags above — Stripe Tax handles rate lookup, line-item display, and remittance reporting.

---

### Phase G5 — Pricing UI Localization

- [ ] `src/lib/geo.ts` exports `formatPrice(amount: number, region: Region): string` using `Intl.NumberFormat` with the correct locale and currency code.
- [ ] `src/components/pricing-card.tsx` — receives `region` from server component, renders the correct localized price string and billing period label.
- [ ] Add a subtle "Prices shown in [currency]" note below the pricing grid.
- [ ] No hard-coded price strings — all amounts come from the regional pricing config.

---

### Rollout Order for Phase 11

```
G1 (Geo Detection) → G2 (Regional Pricing) → G3 (Payment Methods) → G4 (Tax) → G5 (UI)
```

G1 and G2 are blockers for everything else. G3 can proceed in parallel with G4 once G2 is done. G5 is the last UI polish step.

### Exit checklist for Phase 11

- [ ] Checkout flow tested end-to-end in all three regions using Stripe test cards + test UPI
- [ ] Stripe Tax enabled and producing correct line items in test mode for US, EU, IN
- [ ] Pricing page shows correct localized prices for each detected region
- [ ] No hard-coded price strings remain in the codebase
- [ ] EU B2B VAT ID collection + reverse-charge verified

### What's intentionally out of scope (Phase 11)

- Currency conversion at runtime (prices are fixed per region, not floating FX)
- Additional regions: SE Asia (GrabPay, FPX), LATAM (PIX, OXXO), Japan (Konbini)
- Multi-currency invoicing / proration on plan upgrades across regions
- Displaying prices in the user's preferred currency if it differs from their region default

---

## Phase 12 — Performance & cost optimization

**Goal:** Sustain growth without proportional infra cost increase.

- [ ] Edge caching of scan results for public reports
- [ ] Reduce avg scan time from ~75s to <30s
- [ ] Anthropic API cost <$0.001 per scan (down from $0.002 target)
- [ ] Database query audit (no N+1s, all hot paths indexed)
- [ ] CDN-aware report rendering
- [ ] PDF generation moved to async queue (currently synchronous)

---

## Phase 13+ — Future / speculative

Held until earlier phases prove out. Listed for visibility only — not committed.

**Developer workflow integrations (post-traction)**
- CI/CD integration — GitHub Action (`vibesafe/scan-action@v1`), CLI (`npx @vibesafe/cli scan --url … --fail-on critical`), configurable fail thresholds per branch / per environment. Deferred because Phase 10 (scheduled rescans + email) achieves the "we're in your workflow" goal for 1/10th the effort. Revisit once API (Phase 7) is stable and there's demonstrated demand from developer users.
- Public scan badges — embeddable "VibeSafe: A grade" shields for marketing sites; free distribution loop (Snyk model). Requires stable public scan URLs and a badge CDN.
- Slack / Discord notification bot — push `scan.completed` and `finding.critical` events to a channel. Lower effort than CI/CD; revisit if Slack is a common request after Phase 8's team Slack notifications ship.

**Full scan diffing & monitoring**
- Diff view: this scan vs last scan (new findings, resolved findings, regressions) with a side-by-side report
- PR comment integration (requires CI/CD above)
- Grade trend chart on dashboard (multi-month view, beyond Phase 10 sparklines)

**Platform expansion**
- Mobile app (iOS / Android) — only after web product-market-fit confirmed
- Self-hosted enterprise option (Docker + Helm chart)
- Visual regression testing
- AI-powered auto-fix that generates PRs
- SaaS factory product #2 (SpeedCheck)
- White-label licensing
- Additional geo-payment regions: SE Asia (GrabPay, FPX), LATAM (PIX, OXXO), Japan (Konbini)

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
| 2.5. Truth-in-marketing audit | ⏳ Queued | — | — |
| 3. Review & harden scan modules | ⏳ Queued | — | — |
| 4. AI enrichment review & strengthen | ⏳ Queued | — | — |
| 5. Active testing engine | ⏳ Queued | — | — |
| 6. Chrome extension beta | ⏳ Queued | — | — |
| 7. Public API & Webhooks | ⏳ Queued | — | — |
| 8. Team & enterprise | ⏳ Queued | — | — |
| 9. i18n (gated) | 🚫 Blocked on traffic data | — | — |
| 10. Scheduled rescans + email alerts | ⏳ Queued | — | — |
| 11. Geographic payment localization | ⏳ Queued | — | — |
| 12. Performance & cost | ⏳ Queued | — | — |

---

**Document owner:** Engineering
**Review cadence:** Update the status board at the end of every phase; review the queue order whenever priorities shift.
**Cross-reference:** `HARDCODED.md` (the Phase 2 contract), `PHASES.md` (product/business narrative).
