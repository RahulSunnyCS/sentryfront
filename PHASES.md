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

## Phase 5 — LLM Enrichment (Claude Sonnet)
**Goal:** Every scan's findings are enriched with plain-English explanations and AI fix prompts.  
**Duration:** ~3–4 days

### What to build
- `backend/llm/enrichment.py` — Called once per scan after all modules complete
- Batch all raw findings into a single prompt (~2,000–4,000 tokens input)
- Output schema per finding: `explanation` (plain English), `impact` (business risk), `fix_ai_prompt` (Cursor/Lovable/Bolt ready)
- Use `claude-sonnet-4-6` via Anthropic SDK with **prompt caching** on the static system prompt (security context, output format instructions) to minimize cost
- LLM is **secondary to deterministic signals**: only enriches findings already confirmed by module logic; never creates new findings
- Hallucination guard: structured JSON output with `response_format` + post-parse validation; discard enrichment if schema mismatch
- Estimated cost: $0.01–$0.03 per scan

### Deliverable
Report findings display polished plain-English explanations and copy-ready AI fix prompts. Raw module output is preserved in DB for auditability.

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

## Phase 7 — Hardening, Observability & Beta Launch
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

## Phase 8 — Phase 2: Active Testing with Domain Verification
**Goal:** Authenticated users can opt into deeper active scans on domains they own.  
**Duration:** ~3–4 weeks  
**Prerequisite:** Legal review completed before this phase ships.

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

## Phase 9 — Phase 3: Code / Repo Analysis
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
| Legal/abuse | Phase 1 passive-only; Phase 2+ requires domain verification |
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
| Monitoring | Sentry + Axiom + Uptime Robot — Phase 7 |
