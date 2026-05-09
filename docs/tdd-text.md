





TECHNICAL DESIGN DOCUMENT
VibeSafe
System Architecture, Detection Engine, and Infrastructure Design


Version 1.0  |  May 2026
Classification: Internal / Engineering

Table of Contents



System Overview
VibeSafe is a job-oriented, asynchronous security scanning platform. The system accepts a URL, enqueues a multi-stage scan pipeline, executes 15+ independent check modules against the target, normalizes findings into a unified schema, applies LLM-assisted interpretation, and renders results as an interactive web report with exportable formats.
The architecture prioritizes horizontal scalability of scan workers, strict isolation between scanner and target networks, deterministic detection with LLM-augmented interpretation, and sub-90-second scan completion for the passive tier.
System Architecture
High-Level Component Map
Component
Technology
Responsibility
Scaling Model
Web Frontend
Next.js 14+ (App Router), Tailwind CSS, shadcn/ui
URL submission form, real-time scan status via SSE, report dashboard, account/billing management
Vercel Edge, auto-scaled
API Gateway
Node.js (Fastify) or Python (FastAPI)
REST API for scan CRUD, auth (Clerk/NextAuth), rate limiting, webhook endpoints
2–4 instances behind ALB
Job Queue
Redis + BullMQ (Node) or Celery + Redis (Python)
Scan job enqueue, priority queuing (paid > free), retry logic, dead letter queue
Single Redis, HA replica
Scan Workers
Python (primary) or Node.js
Execute check modules, run Playwright, call external APIs (sslyze, crt.sh), emit findings
Horizontal autoscale (0–20 workers based on queue depth)
LLM Service
Claude API (Sonnet) via Anthropic SDK
Finding interpretation, severity reasoning, fix prompt generation, report summarization
API-bound, no infra
Database
PostgreSQL (Supabase or RDS)
Scan metadata, findings, user accounts, billing state, scan history
Single primary + read replica
Object Storage
S3 / R2 (Cloudflare)
PDF reports, scan evidence screenshots, exported artifacts
Unlimited, pay-per-use
Cache
Redis (shared with queue)
Rate limiting counters, scan result caching (TTL: 1 hour), session data
Shared with queue Redis

Data Flow
The scan lifecycle follows a strictly sequential pipeline with parallelism within stages:
User submits URL via frontend. API Gateway validates input (URL format, rate limit, tier eligibility), creates a Scan record in PostgreSQL (status: QUEUED), and enqueues a job to BullMQ/Celery with the scan ID and tier metadata.
A scan worker picks up the job. It transitions the scan to status: RUNNING and begins the Crawl Stage: fetch the target URL with both a plain HTTP client (for raw headers/TLS) and Playwright (for rendered DOM, JS execution, cookies, storage, network interception).
The worker dispatches check modules in parallel. Each module receives the crawl artifacts (raw response, rendered DOM, network log, cookies, storage snapshot, JS bundle URLs) and runs its detection logic independently. Modules emit findings into an in-memory findings array.
After all modules complete, the worker sends the findings batch to the LLM Service for interpretation: severity reasoning, plain-English explanations, and fix prompt generation. The LLM receives the findings array plus detected stack metadata; it returns enriched findings.
Enriched findings are persisted to PostgreSQL. The scan transitions to status: COMPLETED. An SSE event is pushed to the frontend. If the user’s tier includes PDF export, a PDF generation job is enqueued.
The frontend receives the SSE completion event and fetches the full report from the API, rendering the interactive dashboard.
Detection Engine Design
Module Architecture
Each check category is implemented as an independent module conforming to a shared interface. This enables parallel execution, independent testing, and incremental addition of new checks without modifying the orchestrator.
interface CheckModule {
  id: string;                    // e.g., 'P1-01'
  name: string;                  // e.g., 'Client-Side Secret Exposure'
  run(context: CrawlContext): Promise<Finding[]>;
}

interface CrawlContext {
  targetUrl: string;
  rawResponse: { headers: Record<string,string>; status: number; body: string };
  renderedDom: string;            // Playwright page.content()
  jsBundles: { url: string; content: string }[];
  networkLog: NetworkEntry[];      // Playwright CDP network events
  cookies: Cookie[];
  localStorage: Record<string,string>;
  sessionStorage: Record<string,string>;
  tlsInfo: TlsResult;             // from sslyze
  dnsRecords: DnsResult;           // SPF, DKIM, DMARC, CNAMEs
  subdomains: string[];            // from crt.sh CT logs
}

Module Implementation Details
P1-01: Client-Side Secret Exposure
This is the highest-value check and the primary differentiator for early adoption. The detection pipeline has three layers, applied in order of confidence:
Layer 1 — Known Format Regex: Maintained ruleset of ~200 patterns derived from the gitleaks open-source ruleset (MIT licensed). Each pattern has a unique identifier, description, and severity. Patterns cover: Stripe (sk_live_, pk_live_, rk_live_), AWS (AKIA[0-9A-Z]{16}), Supabase (service_role JWT with specific claims), OpenAI (sk-[a-zA-Z0-9]{48}), Firebase (apiKey in config objects), SendGrid (SG\.[a-zA-Z0-9-_]{22}\.[a-zA-Z0-9-_]{43}), Twilio, GitHub PATs, Google API keys, and more.
Layer 2 — Entropy Analysis: For strings not matched by known patterns, calculate Shannon entropy. Strings > 4.5 bits/char and > 20 characters are flagged as “possible secret (review needed)” with severity: INFO. This catches custom or rotated keys that don’t match known formats. Expected false positive rate: 15–25%, which is acceptable at INFO severity.
Layer 3 — LLM Contextual Analysis (post-detection): After Layers 1 and 2 produce candidates, the LLM receives each candidate with 200 characters of surrounding context. It determines: Is this actually a secret? What service does it belong to? What’s the blast radius? This layer never adds new candidates; it only refines and enriches existing ones.
Scan targets: all inline <script> tags in the rendered DOM, all JS bundle files fetched during page load, all .map files (if accessible), and all data-* attributes and JSON-LD blocks.
P1-02: Sourcemap Exposure
For every JavaScript URL observed in the network log, the module constructs the sourcemap URL by appending .map to the original URL and also checking the X-SourceMap and SourceMap response headers. It issues an HTTP HEAD request first (to avoid downloading large files unnecessarily), and if the response is 200 with Content-Type containing “json”, it confirms the finding. Evidence includes the URL and the first 500 bytes of the sourcemap (to show the original file tree in the sources field).
P1-05: Cookie & Storage Hygiene
This module runs inside the Playwright context after the page has fully loaded and all client-side JS has executed.
Cookie analysis: enumerate all cookies via CDP. For each cookie, check: Secure flag (must be true on HTTPS sites), HttpOnly flag (must be true for session/auth cookies, detected by name heuristics: session, token, auth, jwt, sid), SameSite attribute (must be Lax or Strict, not None without Secure), and expiration (session cookies for auth tokens are preferred over persistent).
Storage analysis: read all localStorage and sessionStorage entries. Run the same secret-detection regex from P1-01 against all values. Additionally, attempt JWT decode (base64url split on dots) on any value matching the JWT structure regex. If a decoded JWT payload contains role, admin, is_premium, subscription, or similar fields, flag it as “client-trusted authorization claims” with severity: HIGH.
P1-06: Sensitive Path Exposure
The module maintains a curated list of ~50 sensitive paths grouped by category:
Environment files: /.env, /.env.local, /.env.production, /.env.backup
Source control: /.git/config, /.git/HEAD, /.svn/entries, /.hg/store
IDE/OS artifacts: /.DS_Store, /.vscode/settings.json, /Thumbs.db
Database backups: /backup.sql, /dump.sql, /db.sqlite3, /database.sql
Configuration: /config.json, /config.yml, /wp-config.php, /wp-config.php.bak
Admin/dev interfaces: /admin, /administrator, /phpmyadmin, /adminer.php
API documentation: /swagger, /swagger-ui, /api/docs, /graphql (with introspection query), /openapi.json
Debug endpoints: /debug, /_debug, /__debug__, /_next/data (with build ID enumeration), /trace, /health (if exposing internal state)
For each path, the module sends a GET request with a non-browser User-Agent and checks for 200/301/302 responses. Responses are analyzed for content: a 200 response to /.env that contains KEY= patterns is a confirmed finding; a 200 response to /admin that returns a login page is a lower-severity finding (admin path exists but is gated). GraphQL introspection is tested by sending the standard introspection query; if the schema is returned, severity is HIGH.
P1-07: CORS Misconfiguration
During the Playwright crawl, the module observes all XHR/fetch requests in the network log. For each unique API origin, it replays the request with Origin: https://attacker-vibesafe-test.example.com. The finding is confirmed if the response contains Access-Control-Allow-Origin reflecting the attacker origin AND Access-Control-Allow-Credentials: true. A secondary check tests for Access-Control-Allow-Origin: * combined with credentials. The module also checks for overly permissive Access-Control-Allow-Methods and Access-Control-Allow-Headers.
P1-11: Subdomain Enumeration & Takeover
The module queries the crt.sh API (Certificate Transparency logs) for all certificates issued to the target domain and its subdomains. For each discovered subdomain, it resolves DNS records. Takeover candidates are identified when a CNAME record points to a cloud service that returns a “not found” or default page. The module maintains a fingerprint database of takeover-susceptible services:
Heroku: CNAME to *.herokuapp.com returning “No such app”
GitHub Pages: CNAME to *.github.io returning 404
AWS S3: CNAME to *.s3.amazonaws.com returning NoSuchBucket
Shopify, Tumblr, Unbounce, Fastly, Pantheon, and ~20 other services with known fingerprints
Crawl Engine
Why Playwright, Not HTTP Clients
The target audience builds SPAs (React, Vue, Svelte) via AI tools. These applications render an empty <div id="root"> in the initial HTML response; all content, scripts, and API calls happen after JavaScript execution. A plain HTTP fetch (curl, axios, got) sees nothing useful. Playwright provides: full JavaScript execution and rendering, network interception via Chrome DevTools Protocol (CDP), cookie and storage enumeration after client-side JS runs, and the ability to observe the complete set of API calls the application makes.
Crawl Sequence
Launch a Chromium instance with Playwright in headless mode. Configure: no-sandbox, disable-gpu, timeout 30s, viewport 1920x1080.
Enable CDP network interception to capture all requests/responses including headers, status codes, and response bodies for API calls.
Navigate to the target URL. Wait for networkidle (no pending requests for 500ms) or a 30-second timeout, whichever comes first.
After page load, execute client-side scripts to enumerate: document.cookie (raw), all localStorage entries, all sessionStorage entries, and all service worker registrations.
Extract the full rendered DOM via page.content() and all JS bundle URLs from performance.getEntriesByType(‘resource’).
Fetch each JS bundle’s source text and corresponding .map URL (if referenced in the bundle’s last line or in response headers).
Close the browser instance. Package all artifacts into a CrawlContext object and dispatch to check modules.
Resource Limits
Maximum page load wait: 30 seconds
Maximum JS bundles to fetch: 50 (by descending size)
Maximum total bundle size: 50MB
Maximum network entries to capture: 500
Maximum sensitive paths to probe: 60
DNS resolution timeout: 5 seconds per query
CT log query timeout: 10 seconds
LLM Integration Architecture
Service Design
The LLM service is a thin internal API that wraps the Anthropic Claude API (Sonnet model). It is called exactly once per scan, after all check modules have completed, with the full findings batch. This batch-over-per-finding design minimizes API calls and cost while providing the LLM with cross-finding context (e.g., exposed Stripe key + missing CSP = compounding severity).
Prompt Architecture
The LLM receives a structured prompt with three sections:
System prompt: role definition (“you are a security analyst writing for a non-technical audience”), output format specification (JSON schema for enriched findings), and explicit constraints (never claim a vulnerability exists without the deterministic signal, never fabricate evidence, redact secrets to first/last 4 chars).
Context section: the detected stack metadata (framework, hosting platform, build tool), the target URL, and the scan tier.
Findings section: the raw findings array from all check modules, each with its deterministic evidence.
LLM Output Schema
interface EnrichedFinding {
  original_id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  severity_reasoning: string;        // Why this severity for this site
  explanation: string;               // 2-3 sentences, plain English
  impact: string;                    // What an attacker could do
  fix_manual: string[];              // Step-by-step instructions
  fix_ai_prompt: string;             // Paste-ready for Cursor/Lovable/Bolt
  detected_stack: string;            // e.g., 'Next.js on Vercel'
}
Cost Model
Estimated per-scan LLM cost at current Claude Sonnet pricing:
Input: ~2,000–4,000 tokens (findings batch + system prompt + context)
Output: ~1,500–3,000 tokens (enriched findings for 10–20 findings)
Estimated cost per scan: $0.01–$0.03
At 1,000 scans/month: $10–$30/month in LLM costs
This is negligible relative to infrastructure costs and well within margin at all pricing tiers.
Database Schema
Core Tables
Table
Key Columns
Purpose
Indexes
Retention
users
id, email, tier, stripe_customer_id, created_at
User accounts and billing state
email (unique), stripe_customer_id
Indefinite
scans
id, user_id, target_url, status, tier, started_at, completed_at, grade
Scan metadata and lifecycle tracking
user_id + created_at, status, target_url
90 days (free), indefinite (paid)
findings
id, scan_id, module_id, severity, category, location, evidence, explanation, impact, fix_manual, fix_ai_prompt
Individual vulnerability findings
scan_id, severity, module_id
Matches parent scan
scan_artifacts
id, scan_id, artifact_type, s3_key, size_bytes
References to stored crawl artifacts (screenshots, PDFs)
scan_id
30 days
domain_verifications
id, user_id, domain, method, token, verified_at
Domain ownership proof for Phase 2 active testing
user_id + domain (unique)
Indefinite
Security Architecture (Self-Protection)
A security scanning tool is an attractive target. The architecture must assume adversarial inputs from day one.
Scanner Worker Isolation
Each scan runs in an ephemeral container (ECS Fargate or Fly.io Machine) that is destroyed after the scan completes. No state persists on the worker.
Network egress from workers is restricted to: the target URL’s domain (resolved at enqueue time, not by the worker), crt.sh API, DNS resolvers, and the internal API gateway. All other egress is blocked by security group / firewall rules.
Workers have no access to the primary database. They communicate findings exclusively via the job queue (results channel) or a dedicated internal API endpoint with authentication.
Playwright runs with --no-sandbox disabled (default in container environments) but with additional flags: --disable-dev-shm-usage, --disable-extensions, --disable-background-networking.
Input Validation
URL validation: must be a valid HTTP/HTTPS URL, must resolve to a public IP (reject private ranges: 10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, ::1, fc00::/7), must not be a known scanner honeypot domain.
Response size limits: HTTP responses > 10MB are truncated. JS bundles > 5MB are skipped. Total crawl artifact size capped at 100MB per scan.
Rate limiting: free tier = 1 scan/hour/IP, 1 scan/month/email. Paid tiers = rate limits per plan. Global rate limit = 100 concurrent scans across all workers.
Secret Handling
When the scanner finds secrets in the target’s code, those secrets must be handled carefully in VibeSafe’s own storage:
Evidence field stores redacted secrets only: first 4 and last 4 characters with the middle replaced by asterisks. Example: sk_l****_key3 for a Stripe key.
Full secret values are never persisted to the database, logs, or object storage.
LLM prompts include redacted secrets only. The LLM never sees full key material.
PDF reports display redacted versions. The user is told to search their codebase for the prefix/suffix to locate the full key.
Infrastructure and Deployment
Recommended Stack for MVP
Layer
Recommended
Rationale
Frontend Hosting
Vercel (Next.js native)
Zero-config deployment, edge functions for API routes, free tier sufficient for MVP
API / Workers
Railway or Fly.io (Python/FastAPI)
Container-based, easy scaling, built-in Redis, $5–20/month at MVP scale
Database
Supabase (PostgreSQL)
Free tier for MVP, built-in auth if needed, Row Level Security, easy migration to RDS later
Job Queue
Railway Redis + BullMQ (Node) or Celery (Python)
Simple, battle-tested, built-in retry and DLQ
Object Storage
Cloudflare R2
S3-compatible, zero egress fees, generous free tier
Payments
Stripe (Checkout + Billing Portal)
Standard for SaaS; supports one-shot payments and subscriptions
Monitoring
Sentry (errors) + Axiom (logs) + Uptime Robot
Free/low-cost tiers sufficient for MVP

Estimated Monthly Infrastructure Cost
Component
At 100 scans/month
At 1,000 scans/month
Vercel (frontend)
$0 (free tier)
$0–$20
Railway (API + workers)
$5–$10
$20–$50
Supabase (database)
$0 (free tier)
$25
Redis (job queue)
$0–$5
$10–$15
Cloudflare R2 (storage)
$0 (free tier)
$1–$5
Claude API (LLM)
$1–$3
$10–$30
Monitoring (Sentry + Axiom)
$0
$0–$10
Total
$6–$18
$66–$155

At the Pro tier ($49/month), breakeven is approximately 2–4 paying customers at MVP scale. The unit economics are favorable because the primary costs (Playwright execution, LLM calls) scale linearly with scans, and the per-scan cost is $0.05–$0.15.
API Design
Core Endpoints
Method
Endpoint
Description
Auth Required
POST
/api/v1/scans
Create a new scan. Body: { url: string, tier?: string }
Yes (API key or session)
GET
/api/v1/scans/:id
Get scan status and metadata
Yes (owner only)
GET
/api/v1/scans/:id/findings
Get all findings for a scan
Yes (owner only)
GET
/api/v1/scans/:id/report
Get rendered report (HTML) or PDF export
Yes or shareable token
GET
/api/v1/scans/:id/stream
SSE endpoint for real-time scan progress
Yes (owner only)
POST
/api/v1/domains/verify
Initiate domain verification (Phase 2)
Yes
GET
/api/v1/scans/:id/diff/:prev_id
Compare findings between two scans of the same URL
Yes (owner only)
Report Generation Pipeline
Web Report
The primary report is a web dashboard rendered by the Next.js frontend. Key components:
Header: overall grade (A–F), scan date/time, target URL, detected stack, scan duration.
Severity distribution: horizontal bar chart showing count per severity level.
Findings list: grouped by severity (CRITICAL first), each expandable to show full detail.
Each finding card: icon by category, one-line title, severity badge, expandable body with explanation, evidence (code snippet with syntax highlighting), impact statement, manual fix steps, and a “Copy AI Fix Prompt” button.
Share button: generates a public URL with a unique token (read-only, no auth required).
PDF Report
Generated server-side using Puppeteer rendering the web report template to PDF, with modifications for print layout: page breaks between severity groups, headers/footers with page numbers, and a cover page with the grade and executive summary. White-label variant replaces VibeSafe branding with the agency’s logo (uploaded via the Studio tier settings).
Grading Algorithm
The overall grade is computed from a weighted severity score:
CRITICAL finding: 25 points each
HIGH finding: 10 points each
MEDIUM finding: 3 points each
LOW finding: 1 point each
INFO finding: 0 points
Grade thresholds: A = 0 points, B = 1–9, C = 10–24, D = 25–49, F = 50+. This means a single CRITICAL finding guarantees a D or worse, which is intentional—CRITICAL findings demand immediate action.
Testing Strategy
Detection Accuracy Testing
Each check module has a dedicated test suite with two components:
True positive corpus: a set of intentionally vulnerable test pages hosted on a VibeSafe-controlled domain. Each test page contains exactly the vulnerability the module should detect. The test asserts that the module finds it with correct severity, location, and evidence.
False positive corpus: a set of benign pages that contain patterns superficially similar to vulnerabilities but are not actually issues. Examples: a legitimate base64 string in a data URI that has high entropy but is not a secret; a cookie named “theme” without HttpOnly (acceptable, not a session cookie). The test asserts that the module does NOT produce a finding.
Integration Testing
End-to-end scan against a controlled target site that contains one instance of each Phase 1 vulnerability. The test submits a scan via the API, waits for completion, and asserts that all 15 check categories produce expected findings.
Performance testing: scan completion time must be < 90 seconds for a typical SPA with 10–20 JS bundles and 5–10 API calls.
Development Roadmap
Week
Milestone
Deliverables
Dependencies
1–2
Foundation
Project scaffolding (Next.js + FastAPI), database schema, job queue setup, Playwright crawl engine, CI/CD pipeline
None
3–4
Core Detection
Implement P1-01 (secrets), P1-02 (sourcemaps), P1-03 (headers), P1-04 (TLS), P1-05 (cookies/storage). Unit tests for each module.
Crawl engine complete
5–6
Extended Detection
Implement P1-06 through P1-15. Build true positive and false positive test corpuses. Integration test suite.
Core detection stable
7
LLM Integration
LLM service implementation, prompt engineering, enriched finding generation, fix prompt tailoring by detected stack.
Detection modules complete
8
Report & Launch
Web report dashboard, PDF export, Stripe integration, landing page, free tier launch. First 50 external scans for calibration.
LLM integration stable
9–12
Iteration
False positive tuning based on real scan data, Pro/Studio tier features, scan diff, white-label PDF, API documentation.
Launch data collected
13–16
Phase 2: Active Testing
Domain verification gate, BOLA/IDOR testing, subscription bypass checks, rate limit testing, WebSocket auth checks.
Legal review complete
Appendix: Technology Decision Records
Python vs. Node.js for Workers
Decision: Python for scan workers. Rationale: the security tooling ecosystem is overwhelmingly Python-based. sslyze (TLS analysis), truffleHog (secret scanning patterns), dns.resolver (dnspython), and most OWASP tooling have Python-native libraries. While Playwright supports both Python and Node, the surrounding tooling favors Python. The API gateway can be either (FastAPI for Python consistency, or Fastify if the team prefers Node). The frontend is Next.js regardless.
Claude Sonnet vs. GPT-4o for LLM Layer
Decision: Claude Sonnet (Anthropic). Rationale: superior instruction-following for structured JSON output, lower hallucination rate in security context based on internal evaluation, competitive pricing, and alignment with the team’s existing API familiarity. The LLM layer is abstracted behind the internal service interface, allowing model swaps without pipeline changes.
BullMQ vs. Celery for Job Queue
Decision: either is acceptable; choose based on worker language. If workers are Python, Celery is natural. If workers are Node, BullMQ. Both support priority queues, retry with exponential backoff, dead letter queues, and job progress reporting. The key requirement is that paid-tier jobs have higher priority than free-tier jobs to ensure responsive paid user experience.