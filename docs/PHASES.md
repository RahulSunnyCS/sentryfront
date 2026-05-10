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
| Auth | TBD (Supabase Auth or NextAuth) — Phase 6 |
| Payments | Stripe — Phase 6 |
| Monitoring | Sentry + Axiom + Uptime Robot — Phase 8 |
