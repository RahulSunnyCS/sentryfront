# VibeSafe — Implementation Phases

This document maps the PRD and TDD into concrete, shippable phases. Each phase ends with a working, deployable artifact.

---

## Phase 1 — Foundation & UI Shell
**Goal:** Running Next.js app with all screens wired, no backend required.  
**Duration:** ~1 week

### What to build
- Initialize Next.js 14+ project (App Router, TypeScript, Tailwind, shadcn/ui)
- Migrate the `/design` prototype files into production components under `src/`
  - `LandingPage` → `app/page.tsx`
  - `ScanningPage` → `app/scan/[id]/page.tsx`
  - `ReportPage` → `app/report/[id]/page.tsx`
  - All shared components (grade ring, severity badge, finding card, copy button) → `src/components/`
- Replace the tweaks panel with proper theme config (Tailwind CSS variables)
- Wire navigation: Landing → Scanning (mock progress) → Report (static fixture data)
- Set up lint, format, type-check scripts (`eslint`, `prettier`, `tsc --noEmit`)

### Deliverable
Deployed to Vercel. All three screens render correctly with fixture data. Zero backend calls needed.

---

## Phase 2 — Backend API & Infrastructure ✅
**Goal:** API accepts a scan URL, persists it, and returns an ID. Workers are stubbed.  
**Duration:** ~1 week

### What was built
- **Next.js API routes** (originally planned as Python/FastAPI — switched to keep the stack unified)
- **Prisma 5 + SQLite** for local dev; schema-compatible with PostgreSQL for production
  - Models: `User`, `Scan`, `Finding`, `ScanEvent`, `DomainVerification`
  - Migrations in `prisma/migrations/`
- API endpoints:
  - `POST /api/v1/scans` — validate URL, rate-limit by IP, create `QUEUED` scan record, fire worker
  - `GET /api/v1/scans/:id` — return scan status, grade, score, stack, summary
  - `GET /api/v1/scans/:id/findings` — return findings array (only when COMPLETED/FAILED)
  - `GET /api/v1/scans/:id/stream` — SSE endpoint streaming real progress events
  - `GET /api/health` — db type, status, queue mode
- URL validation (`src/lib/url-validator.ts`): format check, DNS resolution, blocks RFC-1918, loopback, link-local, and cloud metadata IPs (169.254.169.254)
- Rate limiting: in-memory per-IP, 10 scans/hour (configurable via `RATE_LIMIT_PER_HOUR`)
- **Dual-mode event bus** (`src/lib/events.ts`):
  - With `REDIS_URL`: Redis pub/sub via `redis` npm package
  - Without `REDIS_URL`: DB-poll fallback every 500ms (zero-config local dev)
- **Dual-mode worker** (`src/lib/scan-worker.ts`): fire-and-forget Promise in-process; BullMQ queue when Redis is present
- Scan worker stub: simulates 15 modules at ~340ms each, writes fixture findings, computes grade
- Server components query Prisma directly; `src/lib/api.ts` is browser-only (client components)
- Environment: `.env.local` for Next.js runtime, `.env` for Prisma CLI — both gitignored

### Deliverable ✅
Submit a URL from the UI → scan record created in DB → SSE events drive the scanning screen → report rendered with grade, score, and 11 fixture findings. No real vulnerability detection yet.

---

## Phase 3 — Crawler + Core Detection Modules (P1-01 to P1-05)
**Goal:** Real passive scans against any public URL, first five check modules working.  
**Duration:** ~2 weeks

### What to build
**Crawl engine (`backend/crawler/`)**
- Playwright + Chromium headless (Docker base image)
- Capture: HTTP response headers, cookies, localStorage/sessionStorage, all loaded JS bundle URLs, DOM snapshot
- Enforce resource limits: 30s page load, 50 JS bundles, 50 MB total, 500 network entries
- Worker isolation: ephemeral container per scan, destroyed on completion

**Detection modules (`backend/modules/`)**
- `p1_01_secrets.py` — Layer 1: gitleaks regex patterns; Layer 2: Shannon entropy; Layer 3: LLM context (Phase 5). Redact matches to first/last 4 chars before storing.
- `p1_02_sourcemaps.py` — HEAD request to `<bundle>.map`; flag 200 responses
- `p1_03_headers.py` — Parse response headers; check CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- `p1_04_tls.py` — sslyze: TLS version, cipher suites, certificate validity, HSTS preload
- `p1_05_cookies.py` — Playwright cookie enumeration; check Secure, HttpOnly, SameSite; detect JWTs in localStorage; flag sensitive keys

**Module interface**
```python
class Finding(TypedDict):
    module_id: str
    severity: Literal["CRITICAL","HIGH","MEDIUM","LOW","INFO"]
    category: str
    location: str
    evidence: str          # redacted
    explanation: str       # raw, to be enriched in Phase 5
    impact: str
    fix_manual: list[str]
    fix_ai_prompt: str
```

**Grading** — implement scoring formula: CRITICAL=25, HIGH=10, MEDIUM=3, LOW=1, INFO=0; A=0–5, B=6–20, C=21–50, D=51–90, F=90+

**Testing**
- True-positive corpus: intentionally vulnerable test pages (host on Vercel)
- False-positive corpus: clean reference pages
- Target: < 5% false positive rate on CRITICAL/HIGH findings

### Deliverable
Scanning a real URL returns genuine findings for the first 5 modules. Grade calculated and stored. Report page renders live data.

---

## Phase 4 — Extended Detection Modules (P1-06 to P1-15) ✅
**Goal:** All 15 passive checks implemented and tested.  
**Duration:** ~2 weeks

### What was built
All modules implemented in TypeScript under `src/lib/scanner/modules/`:

- **P1-06 sensitive-paths** — GET probe ~50 known paths (`.env`, `/.git/config`, `/admin`, `/swagger`, etc.). Uses a baseline request to a random path first to avoid false positives on catch-all sites.
- **P1-07 cors** — Replays requests with `Origin: https://evil.attacker.example`; detects reflected origin and wildcard + credentials combinations
- **P1-08 mixed-content** — Parses HTML for `http://` script src, form action, img, iframe, video/audio; distinguishes active (scripts/forms) from passive (images/media)
- **P1-09 third-party-scripts** — Enumerates script src domains; classifies into analytics, ads, payment, CDN, auth, monitoring, unknown; flags unrecognized and ad/tracking domains
- **P1-10 dns-email** — Uses Node.js `dns/promises` to query SPF, DMARC records; flags missing policies and weak configurations (`~all`, `p=none`)
- **P1-11 subdomain-takeover** — Queries crt.sh for subdomains, resolves CNAME records, fingerprints against 14 known dangling-CNAME patterns (GitHub Pages, Heroku, Netlify, Vercel, S3, etc.)
- **P1-12 error-disclosure** — Probes error-triggering paths; matches 10 patterns: Node.js/Python/PHP/Ruby/Java stack traces, SQL errors, DB connection strings, framework version strings, internal file paths
- **P1-13 dev-interfaces** — Probes `/graphql`, `/__debug__`, `/_profiler`, `/actuator/env`, `/swagger`, `/phpinfo.php`; sends GraphQL introspection query to detect exposed schema
- **P1-14 robots-sitemap** — Fetches and parses `robots.txt` Disallow entries and `sitemap.xml` URLs; flags sensitive-looking paths using 15 regex patterns
- **P1-15 cache** — Checks `Cache-Control` on responses with session cookies; flags missing `no-store`, missing `private`, and missing `Vary: Cookie`

**Parallelism** — all async I/O modules (P1-01, P1-02, P1-06–P1-14) run via `Promise.all`; sync modules (P1-03, P1-04, P1-05, P1-08, P1-09, P1-15) run after crawl

### Deliverable ✅
Full 15-module passive scan runs end-to-end. Completes in ~6s on example.com. All findings persisted and rendered in report.

---

## Phase 5 — LLM Enrichment (Claude Sonnet) 🚧
**Goal:** Every scan's findings can be enriched with plain-English explanations and AI fix prompts, while scans still complete without a working LLM key.
**Duration:** ~3–4 days

### What has started
- `src/lib/llm/enrichment.ts` — Called once per scan after all deterministic modules complete and before findings are persisted.
- Batch all raw findings into a single Anthropic Messages API prompt, capped to the first 40 findings to control cost and latency.
- Output schema per finding: `explanation` (plain English), `impact` (business risk), `fix_ai_prompt` (Cursor/Lovable/Bolt ready).
- Uses `claude-sonnet-4-20250514` by default, configurable with `ANTHROPIC_MODEL`.
- LLM is **secondary to deterministic signals**: it only updates text fields for findings already confirmed by module logic; it never creates new findings.
- Fail-open behavior: if `ANTHROPIC_API_KEY` is missing, invalid, expired, rate-limited, times out, or returns invalid JSON, the scan keeps the deterministic findings and completes normally.
- Safety guard: prompt payloads are truncated and re-redacted before leaving the worker; full secrets, cookies, credentials, and session tokens should never be sent to the LLM.
- Config escape hatch: set `LLM_ENRICHMENT_ENABLED=false` to disable enrichment even when a key is present.

### Still to build
- Add prompt caching once the Anthropic integration is finalized for production.
- Store enrichment metadata on the scan/report so operators can see whether LLM enrichment was used or skipped.
- Add dedicated tests for missing key, invalid key/API error, timeout, invalid JSON, and successful enrichment.

### Deliverable
Report findings display polished plain-English explanations and copy-ready AI fix prompts when LLM enrichment succeeds. Raw deterministic module output remains usable and report generation still works when LLM enrichment is unavailable.

---

## Phase 6 — Report Polish, PDF Export & Payments
**Goal:** Shippable product. Users can pay, scan, and download a professional report.  
**Duration:** ~1 week

### What to build
**Report UI polish**
- Grade ring animation on load
- Severity filter pills (ALL / CRITICAL / HIGH / MEDIUM / LOW / INFO)
- Expandable finding cards with Manual / AI Prompt tabs and copy-to-clipboard
- Executive summary card (grade, scan duration, total findings by severity)
- Scan diff view: `GET /api/v1/scans/:id/diff/:prev_id` (Pro tier)

**PDF export**
- Puppeteer renders the report page in print layout → uploads to Cloudflare R2 → returns signed URL
- White-label variant: agency logo/colors injected via query param (Studio tier)

**Stripe integration**
- Products: Free (1 scan/month), One-Shot ($29), Pro ($49/month), Studio ($199/month)
- Webhook handler: update `users.tier` on `checkout.session.completed` and `customer.subscription.updated`
- Gate: Free tier shows top 5 findings only + watermark; full report unlocked on payment

**Auth**
- Supabase Auth (magic link or OAuth with GitHub/Google)
- Session cookie → JWT → API middleware validates tier

### Deliverable
End-to-end paid flow works. A user visits the site, submits a URL, sees real findings, pays $29, downloads a PDF report. Ready for beta launch.

---

## Phase 7 — Compliance, Legal & Supply-Chain Readiness
**Goal:** Make VibeSafe safe to commercialize by treating compliance as a launch blocker, not a post-launch cleanup task.
**Duration:** ~1 week
**Why it adds value:** Yes — this materially reduces launch risk for a security product aimed at vibe-coded apps. It prevents accidental use of commercially incompatible dependencies, clarifies what customers are authorized to scan, protects scan evidence and customer data, and creates a trust story that can be reused in sales, onboarding, and enterprise/security questionnaires.

### Compliance risks to address
- **Open-source licensing:** Next.js, React, Prisma, Playwright, BullMQ, Redis clients, scanner rules, fingerprints, and future Python tooling may have license obligations. Avoid copyleft/viral, source-available, non-commercial, or “research only” packages unless explicitly approved.
- **Browser/runtime redistribution:** Playwright downloads and runs browser binaries; confirm redistribution, container image, and CI/CD usage obligations before commercial hosting.
- **Scanner rule provenance:** Secret patterns, subdomain takeover fingerprints, header rules, and sensitive path lists must be original, permissively licensed, or documented with attribution; do not copy proprietary scanner databases.
- **AI/LLM data handling:** Findings may include customer URLs, stack details, redacted secrets, cookies, headers, and code snippets. Confirm Anthropic/model-provider retention, training, subprocessors, and DPA terms before sending production scan data.
- **Customer authorization:** Passive scans can still touch third-party infrastructure. Terms must require users to scan only properties they own or are authorized to test, and active scans must remain behind domain verification.
- **Privacy and data protection:** Scan artifacts may contain personal data, tokens, emails, IP addresses, cookies, and analytics identifiers. Define retention, deletion, export, encryption, access controls, and GDPR/CCPA handling before beta.
- **Payment and tax compliance:** Stripe integration reduces PCI scope, but checkout, invoices, refund policy, tax/VAT collection, and subscription cancellation flows still need documented ownership.
- **Security claims and liability:** Marketing copy should not promise full compliance, certification, or “guaranteed secure” outcomes. Reports need scope disclaimers, severity methodology, and false-positive/false-negative language.
- **Third-party services and subprocessors:** Supabase/Auth provider, Stripe, Cloudflare R2, Sentry, Axiom, Uptime Robot, Redis hosting, Vercel/Railway, and LLM providers must be listed with data categories and regions.
- **Export/sanctions and abuse:** Security tooling can be dual-use. Add abuse monitoring, sanctions/embargo screening via payment/auth providers where available, and a process to disable malicious use.

### What to build
**License and dependency inventory**
- Generate an SBOM for npm dependencies and, when Python workers are added, Python dependencies too.
- Add CI license checks that fail on GPL/AGPL, non-commercial, source-available, unknown, or custom licenses until reviewed.
- Maintain `docs/compliance/third-party-notices.md` with package name, version, license, homepage, usage, attribution notes, and approval status.
- Add a dependency intake checklist for new scanner rules, fingerprints, wordlists, templates, and datasets.

**Legal and product policy docs**
- Draft Terms of Service with authorized-use scanning, prohibited targets, rate-limit/abuse terms, vulnerability disclosure, refund policy, and account termination language.
- Draft Privacy Policy covering scan inputs, findings, logs, cookies, analytics, LLM processing, subprocessors, retention, deletion, and user rights.
- Add report disclaimers: passive vs active scope, evidence redaction, severity methodology, and “not a certification/compliance audit” language.
- Define an abuse contact and DMCA/security/legal escalation owner.

**Data governance**
- Classify data types: account data, payment metadata, scan target URLs, crawl artifacts, redacted evidence, logs, PDFs, screenshots, and LLM prompts/responses.
- Define default retention windows: raw crawl artifacts shortest, logs bounded, reports user-controlled, backups documented.
- Verify secrets are redacted before storage, logs, PDFs, and LLM prompts; add regression tests for redaction boundaries.
- Document encryption in transit/at rest for database, R2/PDF storage, logs, and backups.

**Vendor and AI governance**
- Create a subprocessor register with purpose, data shared, region, retention, DPA status, and opt-out/disable path where feasible.
- Confirm LLM provider commercial terms, data retention/training settings, and whether a zero-retention or enterprise plan is needed before paid launch.
- Gate high-risk enrichment content: never send full secrets, session cookies, auth tokens, or unredacted PII to the LLM.

**Operational controls**
- Add a pre-launch compliance checklist to release management.
- Add admin-only audit logs for report access, PDF generation, payment unlocks, domain verification, and active-scan starts.
- Add a compliance review step for new detection modules that probe external services or import third-party datasets.

### Deliverable
Commercial launch has a documented compliance baseline: SBOM, license policy, third-party notices, ToS, Privacy Policy, subprocessor register, data retention policy, report disclaimers, CI license gate, and go/no-go checklist. Paid beta cannot launch until this phase is complete.

---

## Phase 8 — Hardening, Observability & Beta Launch
**Goal:** Production-grade reliability before opening to public traffic.  
**Duration:** ~1 week

### What to build
- **Monitoring:** Sentry (error tracking, frontend + backend), Axiom (structured logs), Uptime Robot (endpoint health)
- **Rate limiting:** per-IP and per-user scan quotas enforced at API layer
- **Worker egress controls:** allow list — target domain + crt.sh + DNS resolvers + Anthropic API + internal API only; block all other outbound
- **Input hardening:** block private IPs, loopback, link-local, metadata endpoints (169.254.169.254)
- **Scan timeout enforcement:** hard kill worker at 120s; persist partial findings with `TIMEOUT` status
- **Performance testing:** run 10 concurrent scans against test targets; confirm < 90s p95
- **Legal:** ToS and Privacy Policy pages; abuse contact in footer
- **Landing page copy:** finalize tagline, feature bullets, pricing section, FAQ

### Deliverable
Beta launch announcement ready. Site stable under concurrent load. Error rates monitored. Legal pages live.

---

## Phase 5.5 — Performance Scanning (P2-01 to P2-06)
**Goal:** Add comprehensive performance analysis using Lighthouse. Transform VibeSafe from security-only to a complete web quality platform.
**Duration:** ~4-5 days
**ROI:** High — performance is easier to sell than security, appeals to marketing/product teams

### What to build

**Lighthouse Integration** (`src/lib/scanner/lighthouse.ts`)
- Install `lighthouse` and `chrome-launcher` npm packages
- Reuse existing Playwright/Chromium setup for zero additional infrastructure
- Run Lighthouse performance audit alongside security modules
- Parse Core Web Vitals and performance metrics into findings

**Performance modules** (`src/lib/scanner/modules/p2-*.ts`)
- **P2-01: Core Web Vitals** — Google ranking signals (updated 2025 thresholds)
  - LCP (Largest Contentful Paint): GOOD < 2.0s, NEEDS IMPROVEMENT < 4.0s, POOR > 4.0s
  - INP (Interaction to Next Paint): GOOD < 150ms, NEEDS IMPROVEMENT < 500ms, POOR > 500ms (replacing FID in 2026)
  - CLS (Cumulative Layout Shift): GOOD < 0.08, NEEDS IMPROVEMENT < 0.25, POOR > 0.25
  - FCP (First Contentful Paint): GOOD < 1.5s, NEEDS IMPROVEMENT < 3.0s, POOR > 3.0s
  - Severity: HIGH if any metric is POOR, MEDIUM if NEEDS IMPROVEMENT, INFO if GOOD

- **P2-02: Resource Optimization** — Wasted bytes and inefficient assets
  - Uncompressed images (serve modern formats: WebP, AVIF)
  - Unminified JavaScript and CSS
  - Unused JavaScript (code splitting opportunities)
  - Render-blocking resources (critical CSS, deferred JS)
  - Severity: MEDIUM for 500KB+ waste, LOW for < 500KB

- **P2-03: Network Efficiency** — HTTP/2, caching, and connection overhead
  - Too many HTTP requests (> 50 flagged as MEDIUM)
  - Missing cache headers on static assets
  - No HTTP/2 or HTTP/3 usage (check via TLS handshake)
  - Large network payloads (> 1.6MB total transfer size)
  - Severity: MEDIUM for major inefficiencies, INFO for minor

- **P2-04: JavaScript Performance** — Script execution and main thread blocking
  - Total Blocking Time (TBT): GOOD < 200ms, POOR > 600ms
  - Long tasks blocking main thread (> 50ms tasks)
  - Heavy third-party scripts (analytics, ads, widgets)
  - Severity: MEDIUM if TBT > 600ms, LOW otherwise

- **P2-05: Server Response Time** — Backend and CDN performance
  - Time to First Byte (TTFB): GOOD < 800ms, POOR > 1800ms
  - Server response time from Lighthouse timing
  - DNS lookup time, connection time, SSL negotiation time
  - Severity: HIGH if TTFB > 1800ms, MEDIUM if > 800ms

- **P2-06: Mobile Performance** — Responsive design and mobile-specific issues
  - Viewport meta tag presence and configuration
  - Touch target sizes (minimum 48×48 CSS pixels)
  - Content sized correctly for viewport (no horizontal scroll)
  - Mobile-friendly text size (legible without zoom)
  - Severity: MEDIUM for missing viewport, LOW for touch targets

**Grading integration**
- Add separate performance grade (A-F) alongside security grade
- Weight: LCP (25%), INP (25%), CLS (25%), FCP (10%), TBT (10%), TTFB (5%)
- Thresholds: A = all metrics GOOD, B = 1-2 NEEDS IMPROVEMENT, C = 3+ NEEDS IMPROVEMENT or 1 POOR, D = 2+ POOR, F = critical failures

**Report UI updates**
- Add "Performance" tab next to "Security" in report view
- Show Core Web Vitals dashboard with colored bars (green/orange/red)
- Performance findings use same card UI as security findings
- Executive summary shows both security grade and performance grade

**Feature flag**
- `PERFORMANCE_SCANNING_ENABLED=true` (default: false initially)
- `NEXT_PUBLIC_PERFORMANCE_SCANNING_ENABLED=true` for UI visibility
- Tier-gating: Free tier shows grade only, Pro shows full breakdown

**LLM enrichment**
- Performance findings enriched same as security findings
- Prompt context: "This is a performance optimization recommendation..."
- Fix prompts tailored for developers: "Optimize my LCP by converting my hero image from PNG to WebP and adding lazy loading"

### Deliverable
Reports show both security and performance grades. Users can identify performance bottlenecks (slow LCP, large bundles, render-blocking CSS) alongside security issues. Marketing pitch: "The only scanner that finds security AND performance issues."

---

## Phase 6.5 — Accessibility Scanning (P3-01 to P3-05) ✅ **COMPLETE**
**Goal:** Add WCAG 2.2 compliance checking. Enable VibeSafe to satisfy legal/accessibility audits and RFP requirements.
**Duration:** ~3-4 days (Completed: May 10, 2026)
**ROI:** Medium-High — legal compliance driver, opens enterprise market

### What to build

**Lighthouse Accessibility Audit** (reuses existing setup)
- Add `onlyCategories: ['accessibility']` to Lighthouse config
- Parse WCAG 2.2 AA violations into findings
- No new infrastructure needed (same Chromium instance)

**Accessibility modules** (`src/lib/scanner/modules/p3-*.ts`)
- **P3-01: Color & Contrast** — WCAG 2.2 Success Criterion 1.4.3 and 1.4.11
  - Text contrast ratio < 4.5:1 (normal text) or < 3:1 (large text 18pt+)
  - Non-text contrast (UI components, form borders) < 3:1
  - Focus indicators < 3:1 contrast ratio (WCAG 2.2 new)
  - Severity: MEDIUM for text contrast, LOW for non-text
  - Example: "Link text #777 on white background = 4.1:1 (needs 4.5:1)"

- **P3-02: Keyboard Navigation & Focus Management** — WCAG 2.1.1, 2.1.2, 2.4.3, 2.4.7
  - Missing focus indicators (no :focus styles)
  - Keyboard traps (can't escape modal with Tab/Esc)
  - Incorrect tab order (tabindex > 0 anti-pattern)
  - Skip navigation links missing (WCAG 2.4.1)
  - Severity: HIGH for keyboard traps, MEDIUM for missing focus indicators

- **P3-03: Screen Reader Support & ARIA** — WCAG 1.1.1, 1.3.1, 4.1.2
  - Images missing alt text or alt="" for decorative images
  - Form inputs without associated <label> or aria-label
  - Buttons with icon-only (no accessible name)
  - Invalid ARIA usage (aria-hidden on focusable elements)
  - Missing landmark roles (header, nav, main, footer)
  - Severity: HIGH for form labels, MEDIUM for alt text, LOW for landmarks

- **P3-04: Semantic HTML & Document Structure** — WCAG 1.3.1, 2.4.6
  - Heading hierarchy skips levels (h1 → h3, skipping h2)
  - Missing document title or duplicate titles
  - Lists not using <ul>/<ol> markup
  - Tables missing <th> headers or scope attributes
  - Severity: MEDIUM for heading hierarchy, LOW for semantic markup

- **P3-05: Forms & Interactive Elements** — WCAG 3.3.1, 3.3.2, 3.3.3
  - Form error messages not associated with inputs
  - Missing required field indicators (aria-required)
  - Ambiguous link text ("click here", "read more")
  - Auto-playing media without controls (WCAG 1.4.2)
  - Severity: MEDIUM for form errors, LOW for link text

**WCAG Compliance Score**
- Calculate WCAG 2.2 Level AA compliance percentage
- Count: total violations / total checks × 100
- A = 100% compliant, B = 90-99%, C = 75-89%, D = 50-74%, F = < 50%

**Report enhancements**
- Add "Accessibility" tab with WCAG 2.2 badge
- Show compliance level: "WCAG 2.2 Level AA: 87% compliant"
- Group findings by WCAG success criterion (e.g., "1.4.3 Contrast (Minimum)")
- PDF reports include accessibility statement template

**Tier gating**
- Free: Accessibility score only (percentage + grade)
- Pro: Full WCAG 2.2 audit with all violations
- Studio: PDF certification-ready reports (for RFPs, procurement)

### Deliverable
Reports include accessibility compliance scoring. Users can validate WCAG 2.2 Level AA requirements for ADA/legal compliance. PDF reports suitable for accessibility audits and government RFPs.

---

## Phase 7.5 — SEO Scanning (P4-01 to P4-05) ✅ COMPLETE
**Goal:** Add search engine optimization analysis. Attract marketing teams and non-technical stakeholders.
**Duration:** ~3-4 days
**ROI:** Very High — marketing teams will pay for SEO insights
**Status:** ✅ Complete (May 10, 2026)
**Documentation:** [PHASE_7.5_IMPLEMENTATION.md](./PHASE_7.5_IMPLEMENTATION.md)

### What to build

**Lighthouse SEO Audit** + custom checks
- Lighthouse `onlyCategories: ['seo']` for basic SEO
- Custom modules for advanced checks (Open Graph, Schema.org, sitemap)

**SEO modules** (`src/lib/scanner/modules/p4-*.ts`)
- **P4-01: Meta Tags & Titles** — Page metadata for search engines
  - Missing or empty <title> tag
  - <title> too short (< 30 chars) or too long (> 60 chars)
  - Missing meta description or description > 160 chars
  - Duplicate title/description across pages (check via sitemap)
  - Missing canonical URL (rel="canonical")
  - Severity: MEDIUM for missing title, LOW for length issues

- **P4-02: Open Graph & Social Sharing** — Social media preview optimization
  - Missing og:title, og:description, og:image
  - og:image too small (< 1200×630 recommended)
  - Missing Twitter Card tags (twitter:card, twitter:image)
  - Invalid og:type or missing og:url
  - Severity: LOW (SEO/social only, not functional)

- **P4-03: Structured Data & Schema.org** — Rich snippets and search features
  - Missing JSON-LD structured data
  - Invalid Schema.org markup (validate via schema.org validator API)
  - Missing Organization, Product, Article, or Breadcrumb schemas
  - Severity: INFO (opportunity, not a violation)

- **P4-04: Crawlability & Indexing** — Search engine access
  - robots.txt blocks important paths (overlaps with P1-14 but different severity)
  - Missing XML sitemap or sitemap.xml not in robots.txt
  - Noindex tag on public pages (meta robots="noindex")
  - Broken internal links (4xx responses)
  - Orphaned pages (not in sitemap, no internal links)
  - Severity: HIGH for noindex on homepage, MEDIUM for broken links

- **P4-05: Mobile & Core Web Vitals** — Google mobile-first indexing
  - Viewport meta tag missing (overlaps with P2-06)
  - Content wider than viewport (horizontal scroll)
  - Poor Core Web Vitals (flags from P2-01 if LCP/INP/CLS are POOR)
  - Severity: MEDIUM (Google penalizes slow mobile sites)

**SEO Score**
- Weight: Meta tags (30%), Crawlability (25%), Structured data (20%), Social tags (15%), Mobile (10%)
- A = 90-100, B = 80-89, C = 70-79, D = 60-69, F = < 60

**Report UI**
- Add "SEO" tab with search preview card (how page looks in Google)
- Show missing opportunities (Schema.org types, social cards)
- Link to Google Search Console for real search performance data

**Tier gating**
- Free: SEO score + top 3 recommendations
- Pro: Full SEO audit
- Studio: Competitor comparison (if we add multi-site scanning later)

### Deliverable
Marketing teams can run VibeSafe scans to optimize search rankings. Reports show actionable SEO improvements (meta tags, structured data, social cards). Product managers can track SEO health alongside security.

---

## Phase 8.2 — False Positive Management
**Goal:** Allow users to suppress false positives with proper documentation and audit trails
**Duration:** ~5-7 days
**ROI:** High — Reduces noise, improves user trust, critical for enterprise adoption

### What to build

**Suppression Data Model** (`prisma/schema.prisma`)
- `Suppression` model — Store suppression rules (moduleId, pattern, reason, expires, approvedBy)
- `SuppressionEvent` model — Audit trail for all suppression actions
- User relationship — Suppressions tied to user accounts
- Expiration support — Auto-expire suppressions after a set date

**Suppression Engine** (`src/lib/suppressions/`)
- **Matcher** — Pattern matching against findings (regex, exact match, URL patterns)
- **Service** — Apply suppressions to scan results
- **Parser** — Parse `.vibesafe-ignore` YAML files
- **Validator** — Ensure suppression rules are safe and valid

**API Endpoints** (`src/app/api/v1/suppressions/`)
- `POST /suppressions` — Create new suppression
- `GET /suppressions` — List user's suppressions
- `GET /suppressions/:id` — Get specific suppression
- `PUT /suppressions/:id` — Update suppression
- `DELETE /suppressions/:id` — Delete suppression
- `GET /suppressions/:id/events` — View suppression history

**Scan Integration**
- Add `applySuppressions` parameter to scan API
- Filter findings during scan processing
- Track suppressed findings in scan metadata
- Generate suppression report alongside findings

**UI Components**
- Suppression manager dashboard
- "Suppress this finding" button on each finding
- Quick suppression dialog
- Suppression history viewer
- Toggle to show/hide suppressed findings

**File-Based Suppressions** (Optional)
- Support `.vibesafe-ignore` file in target repository
- Parse YAML format suppressions
- Merge with database suppressions
- Validate rules before applying

### Testing
- Unit tests for matcher logic
- Integration tests for API endpoints
- E2E tests for suppression workflow
- Test expiration handling
- Test audit trail

### Deliverable
Users can suppress false positives with proper documentation, approval workflow, and audit trail. Suppressions auto-expire and are tracked for compliance. Enterprise customers can review suppression history.

**Documentation:**
- `docs/FALSE_POSITIVES.md` — User guide
- `docs/FALSE_POSITIVES_QUICK_START.md` — Quick reference
- `docs/FALSE_POSITIVES_IMPLEMENTATION.md` — Technical specs

---

## Phase 8.5 — Privacy & GDPR Compliance (P5-01 to P5-06)
**Goal:** Add privacy regulation compliance checking (GDPR, CCPA, ePrivacy). Critical for enterprise sales and EU customers.
**Duration:** ~4-5 days
**ROI:** Very High — GDPR fines are 4% of revenue, enterprises need this

### What to build

**Privacy compliance modules** (`src/lib/scanner/modules/p5-*.ts`)
- **P5-01: Cookie Consent & Banners** — GDPR/ePrivacy compliance
  - No cookie consent banner detected (check for common libraries: Cookiebot, OneTrust, Termly)
  - Cookies set before consent (check timing: cookies present on first load)
  - Non-essential cookies without explicit consent (analytics, advertising)
  - Missing "Reject All" button (GDPR requires granular choice)
  - Severity: HIGH for EU visitors, MEDIUM otherwise (check via GeoIP or declare region)

- **P5-02: Third-Party Trackers & Analytics** — Data sharing without consent
  - Google Analytics loaded without consent (check for gtag.js, analytics.js before consent)
  - Facebook Pixel, TikTok Pixel, LinkedIn Insight Tag without consent
  - Third-party scripts sending data (overlap with P1-09 but privacy focus)
  - CDN usage outside declared regions (e.g., Cloudflare US for EU-only site)
  - Severity: HIGH (GDPR violations can be €20M fines)

- **P5-03: Privacy Policy & Legal Pages** — Transparency requirements
  - Missing privacy policy link in footer
  - Privacy policy not updated in 12+ months (check via Wayback Machine API or timestamp in page)
  - Missing GDPR-required sections (data controller, legal basis, retention, user rights)
  - No cookie policy or data processing agreement linked
  - Severity: MEDIUM (legal requirement but harder to enforce)

- **P5-04: Data Minimization & Collection** — Collect only necessary data
  - Forms request excessive data (e.g., phone number for newsletter signup)
  - Email collection without purpose statement ("We collect your email to send you updates")
  - Hidden form fields capturing browser fingerprints
  - Severity: LOW (best practice, not always legally required)

- **P5-05: User Rights & Data Access** — GDPR Articles 15-22
  - No clear way to request data export (GDPR Article 15)
  - No account deletion option (right to erasure, Article 17)
  - No unsubscribe link in email capture forms
  - Severity: MEDIUM (GDPR requires these but enforcement varies)

- **P5-06: Cross-Border Data Transfers** — GDPR Chapter V
  - Third-party services in non-adequate countries (US, China, Russia without SCCs)
  - Data sent to US services post-Schrems II without new Data Privacy Framework
  - Check server locations via IP geolocation for API calls
  - Severity: HIGH for EU businesses (major GDPR violation)

**GDPR Compliance Score**
- Calculate compliance: violations by severity weighted
- A = GDPR-ready (0 HIGH, 0-1 MEDIUM), B = minor issues (2-3 MEDIUM), C = needs work (1 HIGH or 4+ MEDIUM), D = non-compliant (2+ HIGH), F = critical violations (3+ HIGH)

**Report enhancements**
- Add "Privacy" tab with GDPR/CCPA badge
- Show "EU Compliance Risk Level: HIGH/MEDIUM/LOW"
- Include links to GDPR articles for each violation
- PDF reports include compliance summary for legal review

**Feature flags**
- `PRIVACY_SCANNING_ENABLED=true`
- `PRIVACY_REGION` (EU, US, GLOBAL) — adjusts severity (EU strictest)

**Tier gating**
- Free: Privacy score only
- Pro: Full GDPR audit
- Studio: Compliance reports for legal/DPO review, subprocessor register

### Deliverable
Enterprise customers can validate GDPR/CCPA compliance before EU launch. Reports identify privacy violations (cookies without consent, missing policies, cross-border transfers). Legal teams can use PDF reports for compliance audits.

---

## Phase 9.5 — Best Practices & Code Quality (P6-01 to P6-04)
**Goal:** Add general web best practices (browser compatibility, modern standards, deprecations).
**Duration:** ~2 days
**ROI:** Low-Medium — bonus category, mostly free from Lighthouse

### What to build

**Best practices modules** (`src/lib/scanner/modules/p6-*.ts`)
- **P6-01: HTTPS & Security Basics** — Foundational security (overlaps with P1-04 but simpler)
  - HTTP instead of HTTPS
  - Mixed content (HTTPS page loading HTTP resources) — flags from P1-08
  - Insecure form submission (< form action="http://...")
  - Severity: HIGH for no HTTPS, MEDIUM for mixed content

- **P6-02: Modern Standards & Formats** — Progressive enhancement
  - No WebP/AVIF images (still using JPEG/PNG only)
  - No lazy loading for below-fold images
  - Old JavaScript APIs (document.write, synchronous XHR)
  - Missing Service Worker for PWA capabilities
  - Severity: INFO (opportunities, not violations)

- **P6-03: Browser Compatibility** — Cross-browser support
  - Deprecated APIs (Application Cache, WebSQL)
  - Vendor prefixes in CSS (-webkit-, -moz- without standard version)
  - IE-specific code (conditional comments, ActiveX)
  - Severity: LOW (most sites don't support IE11 anymore)

- **P6-04: Console Errors & Warnings** — Runtime issues
  - JavaScript errors in browser console
  - Failed network requests (non-critical resources)
  - Deprecation warnings (upcoming API changes)
  - Severity: MEDIUM for JS errors, INFO for warnings

**Best Practices Score**
- Lighthouse already provides this for free
- A = 90-100, B = 80-89, C = 70-79, D = 60-69, F = < 60

**Report UI**
- Add "Best Practices" tab (optional, can be combined with Security)
- Show modern web features score

**Tier gating**
- Free: Score only
- Pro: Full breakdown

### Deliverable
Bonus category that rounds out the platform. Lighthouse gives us this almost for free. Positions VibeSafe as a comprehensive tool.

---

## Phase 9 — Phase 2: Active Testing with Domain Verification
**Goal:** Authenticated users can opt into deeper active scans on domains they own.  
**Duration:** ~3–4 weeks  
**Prerequisite:** Phase 7 compliance sign-off completed before this phase ships.

### What to build
- Domain verification flow: DNS TXT record method (add `vibesafe-verify=<token>` → poll DNS)
- Active check modules (require verified domain):
  - BOLA/IDOR: enumerate object IDs in API calls; replay with different session
  - Subscription/paywall bypass: attempt to access premium resources without valid entitlement
  - Rate limiting: burst requests against auth endpoints; flag missing throttling
  - Server-side validation bypass: replay API calls with modified numeric/enum fields
  - WebSocket authentication: connect without valid token; attempt message injection
- Phase 2 findings run in a separate, more strictly isolated worker with dedicated egress controls
- Report distinguishes Passive vs Active findings with clear labeling

### Deliverable
Pro/Studio users can verify domain ownership and run active scans. Additional finding categories appear in reports.

---

## Phase 10 — Phase 3: Code / Repo Analysis
**Goal:** Users can connect a GitHub repo for deep static analysis.  
**Duration:** ~3–4 weeks

### What to build
- GitHub OAuth app → read-only repo access
- Static analysis modules:
  - Dependency CVE scanning (pip-audit, npm audit, OSV API)
  - Hardcoded secrets in git history (truffleHog)
  - Insecure code patterns (semgrep rules for auth, crypto, injection)
  - Authentication logic review (LLM-assisted with structured prompts)
- Findings linked back to specific file + line number
- PR comment integration: post summary as GitHub Check on new PRs (CI mode)

### Deliverable
Studio users can connect repos. Full static analysis report merged with passive scan findings into a unified security posture view.

---

## Cross-Cutting Concerns (all phases)

| Concern | Approach |
|---|---|
| Secrets in storage | Redact to first/last 4 chars; never persist full values |
| LLM cost control | Single batch call per scan; prompt caching on system prompt |
| False positive rate | Conservative thresholds; deterministic signals primary; target < 5% on CRITICAL/HIGH |
| Worker isolation | Ephemeral container destroyed after each scan |
| Legal/abuse | Passive scans start unauthenticated, but ToS restricts use to authorized targets; active scans require domain verification; abuse contact and escalation process before beta |
| Open-source licensing | SBOM + CI license gate; block non-commercial/source-available/copyleft dependencies until reviewed |
| Privacy/data retention | Minimize raw crawl artifact storage; redact secrets before DB/log/PDF/LLM; documented deletion and retention windows |
| Vendor governance | Subprocessor register for Auth, payments, storage, monitoring, hosting, Redis, and LLM providers |
| Security claims | Reports must state scope, methodology, limitations, and that results are not a formal certification or guaranteed security attestation |
| Scalability | Stateless API + queue-based workers; scale workers horizontally |

---

## Infrastructure Stack Summary

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS → Vercel |
| API | Next.js API routes (`/api/v1/...`) — same process as frontend |
| Workers | In-process fire-and-forget (dev); BullMQ + Redis worker (production) |
| Queue | Optional Redis + BullMQ; falls back to in-process Promise automatically |
| Database | SQLite + Prisma (local dev); PostgreSQL + Prisma (production) |
| Storage | Cloudflare R2 (PDFs, screenshots) — Phase 6 |
| LLM | Claude Sonnet via Anthropic SDK — Phase 5 |
| Auth | NextAuth (GitHub + Google OAuth) — Phase 6 |
| Payments | Stripe — Phase 6 |
| Monitoring | Sentry + Axiom + Uptime Robot — Phase 8 |
| **Performance** | **Lighthouse + Chrome Launcher — Phase 5.5** |
| **Accessibility** | **Lighthouse accessibility audit — Phase 6.5** |
| **SEO** | **Lighthouse SEO + custom checks — Phase 7.5** |
| **Privacy** | **Custom GDPR/CCPA compliance modules — Phase 8.5** |

---

## Complete Module Catalog (After All Phases)

VibeSafe will offer **45+ detection modules** across **7 categories**:

### Category 1: Security (P1-01 to P1-15) — ✅ **COMPLETE**
Core security vulnerability detection (passive scans, no domain verification required)

| Module | Name | Status |
|--------|------|--------|
| P1-01 | Client-Side Secrets | ✅ Done |
| P1-02 | Sourcemap Exposure | ✅ Done |
| P1-03 | Security Headers | ✅ Done |
| P1-04 | TLS Configuration | ✅ Done |
| P1-05 | Cookie & Storage Hygiene | ✅ Done |
| P1-06 | Sensitive Paths | ✅ Done |
| P1-07 | CORS Configuration | ✅ Done |
| P1-08 | Mixed Content | ✅ Done |
| P1-09 | Third-Party Scripts | ✅ Done |
| P1-10 | DNS & Email Security | ✅ Done |
| P1-11 | Subdomain Takeover | ✅ Done |
| P1-12 | Error Disclosure | ✅ Done |
| P1-13 | Admin/Dev Interfaces | ✅ Done |
| P1-14 | robots.txt & Sitemap | ✅ Done |
| P1-15 | Cache Configuration | ✅ Done |

### Category 2: Performance (P2-01 to P2-06) — 🔜 **Phase 5.5**
Google Core Web Vitals and performance optimization (Lighthouse integration)

| Module | Name | Focus |
|--------|------|-------|
| P2-01 | Core Web Vitals | LCP, INP, CLS, FCP (2025 thresholds) |
| P2-02 | Resource Optimization | Uncompressed images, unminified JS/CSS |
| P2-03 | Network Efficiency | HTTP/2, caching, request count |
| P2-04 | JavaScript Performance | TBT, long tasks, heavy scripts |
| P2-05 | Server Response Time | TTFB, DNS, SSL negotiation |
| P2-06 | Mobile Performance | Viewport, touch targets, responsive |

### Category 3: Accessibility (P3-01 to P3-05) — ✅ **Phase 6.5 COMPLETE**
WCAG 2.2 Level AA compliance (legal/RFP requirement for enterprise)

| Module | Name | WCAG Focus |
|--------|------|------------|
| P3-01 | Color & Contrast | 1.4.3, 1.4.11 (4.5:1 ratio) |
| P3-02 | Keyboard Navigation | 2.1.1, 2.1.2, 2.4.7 (focus, traps) |
| P3-03 | Screen Reader Support | 1.1.1, 4.1.2 (alt text, ARIA) |
| P3-04 | Semantic HTML | 1.3.1, 2.4.6 (headings, structure) |
| P3-05 | Forms & Interactions | 3.3.1, 3.3.2 (labels, errors) |

### Category 4: SEO (P4-01 to P4-05) — 🔜 **Phase 7.5**
Search engine optimization and social sharing (marketing team appeal)

| Module | Name | Focus |
|--------|------|-------|
| P4-01 | Meta Tags & Titles | Title, description, canonical |
| P4-02 | Open Graph & Social | OG tags, Twitter Cards, preview images |
| P4-03 | Structured Data | Schema.org, JSON-LD, rich snippets |
| P4-04 | Crawlability & Indexing | Sitemap, robots.txt, broken links |
| P4-05 | Mobile & Core Web Vitals | Mobile-first indexing, speed |

### Category 5: Privacy & Compliance (P5-01 to P5-06) — 🔜 **Phase 8.5**
GDPR, CCPA, ePrivacy regulation compliance (enterprise blocker)

| Module | Name | Regulation |
|--------|------|------------|
| P5-01 | Cookie Consent & Banners | GDPR, ePrivacy (consent before cookies) |
| P5-02 | Third-Party Trackers | GDPR Art 6 (data sharing without consent) |
| P5-03 | Privacy Policy & Legal | GDPR Art 13-14 (transparency) |
| P5-04 | Data Minimization | GDPR Art 5 (collect only necessary) |
| P5-05 | User Rights & Data Access | GDPR Art 15-22 (export, deletion) |
| P5-06 | Cross-Border Transfers | GDPR Chapter V (SCCs, adequacy) |

### Category 6: Best Practices (P6-01 to P6-04) — 🔜 **Phase 9.5**
General web standards and modern practices (Lighthouse bonus)

| Module | Name | Focus |
|--------|------|-------|
| P6-01 | HTTPS & Security Basics | HTTPS enforcement, secure forms |
| P6-02 | Modern Standards | WebP/AVIF, lazy loading, PWA |
| P6-03 | Browser Compatibility | Deprecated APIs, vendor prefixes |
| P6-04 | Console Errors | JS errors, failed requests, warnings |

### Category 7: Active Security (A1-01 to A1-05) — 🔮 **Phase 9** (Future)
Authenticated/active testing (requires domain verification)

| Module | Name | Risk Level |
|--------|------|------------|
| A1-01 | BOLA/IDOR Testing | HIGH (replays requests) |
| A1-02 | Subscription Bypass | HIGH (attempts paywall bypass) |
| A1-03 | Rate Limiting | MEDIUM (burst requests) |
| A1-04 | Server-Side Validation | MEDIUM (replays with modified params) |
| A1-05 | WebSocket Authentication | MEDIUM (message injection) |

### Category 8: Code Analysis (C1-01 to C1-04) — 🔮 **Phase 10** (Future)
Repository and static analysis (GitHub integration)

| Module | Name | Focus |
|--------|------|-------|
| C1-01 | Dependency CVE Scanning | npm audit, OSV API, known vulnerabilities |
| C1-02 | Secrets in Git History | truffleHog, historical commits |
| C1-03 | Insecure Code Patterns | semgrep (auth, crypto, injection) |
| C1-04 | LLM Code Review | Authentication logic, session management |

---

## Product Evolution Summary

### **Current State** (Phases 1-4 complete)
- **Positioning**: "Security scanner for vibe-coded apps"
- **Target**: Security engineers, DevOps
- **Modules**: 15 (security only)
- **Market**: Niche security tool

### **After Phases 5.5-9.5** (Performance, A11y, SEO, Privacy added)
- **Positioning**: "Complete web quality platform: Security, Performance, Accessibility & Compliance"
- **Target**: CTOs, Engineering Managers, Product Teams, Marketing, Legal/Compliance
- **Modules**: 35+ across 6 categories
- **Market**: Comprehensive platform competing with Lighthouse, WebPageTest, Axe DevTools, SecurityScorecard

### **Future State** (Phases 9-10)
- **Positioning**: "End-to-end application security & quality platform"
- **Target**: Enterprise security teams, Dev teams, Compliance officers
- **Modules**: 45+ across 8 categories
- **Market**: Enterprise platform with active testing and CI/CD integration

---

## Revenue & Tier Gating Strategy

### **Free Tier** (Always free, no credit card)
- 1 scan per week
- Security grade (A-F) + Performance grade + Accessibility grade
- Top 5 findings across all categories
- Basic report (web view only)

### **Pro Tier** ($49/month or $29 one-shot)
- Unlimited scans
- Full findings for Security + Performance + Accessibility + SEO
- PDF export (download, no cloud storage)
- Scan diff comparison (compare two scans)
- LLM-enriched explanations
- Email reports

### **Studio Tier** ($199/month)
- Everything in Pro
- Privacy/GDPR compliance scanning
- White-label PDF reports (agency logo/colors)
- Historical trend tracking (performance over time)
- Multi-user team accounts
- Priority support
- Compliance certification templates

### **Enterprise Tier** (Custom pricing)
- Everything in Studio
- Active security testing (domain verification required)
- Code/repo analysis (GitHub integration)
- Custom compliance frameworks
- Dedicated account manager
- SLA guarantee
- On-premise deployment option

---

## Competitive Positioning After Expansion

| Competitor | Security | Performance | A11y | SEO | Privacy | Code Analysis |
|------------|----------|-------------|------|-----|---------|---------------|
| **VibeSafe** | ✅✅✅ | ✅✅ | ✅✅ | ✅✅ | ✅✅ | ✅ (Phase 10) |
| Lighthouse | ⚠️ Basic | ✅✅✅ | ✅✅ | ✅ | ❌ | ❌ |
| SecurityScorecard | ✅✅ | ❌ | ❌ | ❌ | ⚠️ Basic | ❌ |
| Axe DevTools | ❌ | ❌ | ✅✅✅ | ❌ | ❌ | ❌ |
| WebPageTest | ❌ | ✅✅✅ | ❌ | ⚠️ Basic | ❌ | ❌ |
| Snyk | ✅ (code) | ❌ | ❌ | ❌ | ❌ | ✅✅✅ |
| OneTrust | ❌ | ❌ | ❌ | ❌ | ✅✅✅ | ❌ |

**VibeSafe's unique value**: Only tool that covers **all dimensions of web quality** in a single scan.

---

## Implementation Priority & Timeline

| Phase | Category | Days | Priority | Dependency |
|-------|----------|------|----------|------------|
| **5.5** | Performance | 4-5 | 🔥 **IMMEDIATE** | None (can start now) |
| 6 | Payments & PDF | 7 | High | Phase 7 (legal) |
| 6.5 | Accessibility | 3-4 | High | None (Lighthouse) |
| 7 | Compliance & Legal | 7 | 🚨 **BLOCKER** | Must do before paid beta |
| 7.5 | SEO | 3-4 | High | Phase 5.5 (Lighthouse setup) |
| 8 | Hardening & Beta | 7 | 🚨 **BLOCKER** | Phase 7 |
| 8.5 | Privacy/GDPR | 4-5 | Very High | None (custom modules) |
| 9.5 | Best Practices | 2 | Low | Phase 5.5 (Lighthouse) |
| 9 | Active Testing | 21 | Future | Phase 7 (legal), domain verification |
| 10 | Code Analysis | 21 | Future | GitHub OAuth |

**Recommended sequence:**
1. **Phase 5.5 (Performance)** — Start immediately, 4-5 days, huge ROI
2. **Phase 7 (Compliance)** — Legal blocker, must complete before monetization
3. **Phase 6 (Payments)** — Enable revenue stream
4. **Phase 6.5 (Accessibility)** — Quick win, 3-4 days
5. **Phase 8 (Hardening)** — Performance testing, final prep
6. **Phase 7.5 (SEO)** — Marketing appeal, post-launch
7. **Phase 8.5 (Privacy/GDPR)** — Enterprise requirement
8. **Phase 9.5 (Best Practices)** — Bonus, almost free

**Total time to comprehensive platform**: ~6-7 weeks of focused development
