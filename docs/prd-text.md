





PRODUCT REQUIREMENTS DOCUMENT
VibeSafe
Automated Security Scanner for Vibe-Coded Websites


Version 1.0  |  May 2026
Classification: Internal / Confidential

Table of Contents



Executive Summary
VibeSafe is a one-click, URL-based security scanner designed for non-technical website builders using AI-assisted development tools such as Lovable, Bolt, v0, Cursor, and Replit. As “vibe coding” accelerates, an increasing number of production websites are being shipped by creators who lack security expertise, resulting in exposed API keys, misconfigured headers, insecure storage practices, and exploitable authentication flows.
VibeSafe addresses this gap by providing an automated, passive security audit that requires no CLI installation, no codebase access, and no security knowledge. It outputs findings in plain English with severity-prioritized remediation guidance, including paste-ready prompts tailored to the user’s AI development tool. The product’s differentiation lies not in novel detection technology, but in packaging established security checks for a fundamentally new audience with a fundamentally new remediation interface.
Problem Statement
Market Context
AI-assisted website builders (Lovable, Bolt, v0, Cursor, Replit Agent) have enabled a new class of creators—product managers, designers, solo founders, marketers—to ship production web applications without traditional software engineering training. These tools optimize for speed-to-deploy, not security posture.
Core Problems
LLMs routinely hardcode secret keys (Stripe live keys, Supabase service role keys, OpenAI tokens) into client-side bundles when asked to “connect to X.”
Default build configurations ship sourcemaps, debug endpoints, and verbose error pages to production.
Security headers (CSP, HSTS, X-Frame-Options) are absent because no one asked the LLM to add them.
Authentication tokens stored in localStorage are vulnerable to any XSS vector, and JWTs with client-trusted role claims enable privilege escalation.
Existing security tools (Burp Suite, OWASP ZAP, Snyk, Detectify) assume a security-literate operator, CLI fluency, and CI/CD pipeline integration—none of which this audience possesses.
Opportunity
There is an unserved gap between free single-purpose checkers (Mozilla Observatory, SSL Labs) and commercial SMB security platforms ($200–$500/month). The vibe-coding audience needs a product that operates at the abstraction level they work at: paste a URL, get a report, paste the fix into Cursor.
Target Users
Segment
Profile
Primary Job-to-be-Done
Willingness to Pay
Solo Indie Hacker
Non-technical builder who shipped via Lovable/Bolt/v0
Pre-launch confidence check; shareable proof of security
$19–$49 one-shot
Early-Stage SaaS Founder
Has paying customers; revenue at risk from breaches
Ongoing monitoring; catch regressions weekly
$49–$99/month
Agency / Freelancer
Builds sites for clients; wants QA deliverable
White-label reports as part of delivery pipeline
$199–$499/month
Non-Technical Business Owner
Inherited a site; does not trust the developer
Independent third-party audit at 1/20th consultant cost
$49–$99 one-shot
Product Vision and Principles
Vision Statement
Every website shipped with AI tools should have a security co-pilot that speaks the builder’s language, not the auditor’s.
Design Principles
Zero-configuration entry: URL in, report out. No CLI, no GitHub, no config files.
Plain English over CVSS scores: findings must be comprehensible to someone who has never heard of OWASP.
Remediation over detection: every finding includes a paste-ready fix prompt for the user’s AI coding tool.
Passive-first: Phase 1 requires no authorization gate because all checks observe only what a normal browser would see.
Conservative over comprehensive: a false positive (claimed bug that isn’t real) is worse than a false negative (missed bug), because it destroys trust.
Scope and Phasing
Phase 1: Passive External Scan (MVP — Weeks 1–8)
All checks in Phase 1 are passive, require no domain ownership verification, and observe only publicly accessible information. This eliminates legal risk and removes the authorization gate from the critical path.
ID
Check Category
What It Detects
Severity
Detection Method
P1-01
Client-Side Secret Exposure
Hardcoded API keys (Stripe, Supabase, AWS, OpenAI, Firebase, SendGrid, Twilio) in JS bundles and inline scripts
CRITICAL
Regex (gitleaks ruleset) + entropy analysis
P1-02
Sourcemap Exposure
Production .map files serving full original source tree
HIGH
HTTP probe: .js URL + .map suffix
P1-03
Security Headers Audit
Missing/misconfigured CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy; leaky Server/X-Powered-By
MEDIUM–HIGH
HTTP HEAD request + header parse
P1-04
TLS Configuration
Expired certs, weak ciphers, TLS 1.0/1.1, missing OCSP stapling, chain issues
MEDIUM
sslyze / SSL Labs API
P1-05
Cookie & Storage Hygiene
Missing Secure/HttpOnly/SameSite on cookies; JWTs in localStorage; secrets in storage; client-trusted role claims in JWT payloads
HIGH
Playwright: enumerate cookies + storage, decode JWTs
P1-06
Sensitive Path Exposure
Publicly accessible /.env, /.git/config, /.DS_Store, /backup.sql, /config.json, /wp-config.php.bak
CRITICAL
HTTP GET to known sensitive paths
P1-07
CORS Misconfiguration
Reflected origin with credentials allowed; wildcard origin with credentials
HIGH
Replay observed API calls with evil origin header
P1-08
Mixed Content & Insecure Forms
HTTP resources on HTTPS pages; form actions pointing to HTTP
MEDIUM
DOM parse of rendered page
P1-09
Third-Party Script Inventory
External scripts without SRI; scripts from unknown/suspicious origins; outdated framework versions
LOW–MEDIUM
DOM parse + version fingerprint
P1-10
DNS & Email Security
Missing or misconfigured SPF, DKIM, DMARC records
MEDIUM
DNS TXT record lookups
P1-11
Subdomain Enumeration
CNAME records pointing to deprovisioned cloud resources (subdomain takeover candidates)
HIGH
Certificate Transparency logs (crt.sh) + DNS resolution
P1-12
Information Disclosure in Errors
Stack traces, framework versions, internal paths in 404/500 responses
MEDIUM
Trigger 404/500 via long URL or malformed Accept header
P1-13
Exposed Dev/Admin Interfaces
Publicly accessible /admin, /swagger, /graphql (introspection enabled), /api/docs, /_next/data, debug endpoints
HIGH
HTTP GET to common dev/admin paths
P1-14
robots.txt & Sitemap Leakage
Sensitive internal paths advertised in robots.txt Disallow rules
LOW
Parse robots.txt and sitemap.xml
P1-15
Cache Misconfiguration
Authenticated/personalized responses missing Cache-Control: private, no-store
MEDIUM
Inspect cache headers on cookie-setting responses

Phase 2: Active Testing with Authorization (Weeks 9–16)
Phase 2 unlocks active checks gated behind domain ownership verification (DNS TXT record or well-known file placement). These checks send crafted requests to test server-side validation.
Broken access control (BOLA/IDOR): replay API requests with modified resource IDs.
Subscription/paywall bypass: intercept and flip boolean flags or role strings in API responses; verify server acceptance.
Rate limiting absence on auth endpoints: send rapid requests to login/signup/password-reset.
Server-side validation bypass: submit malformed payloads to forms and API endpoints.
WebSocket authentication: attempt unauthenticated WS connections to detected endpoints.
Phase 3: Static Analysis with Code Access (Weeks 17–24)
Phase 3 adds optional codebase ingestion for deeper analysis. Users connect their GitHub repository or upload a zip.
Dependency CVE scanning: cross-reference package.json / requirements.txt against NVD and OSV databases.
Hardcoded secrets in git history: scan full commit history for keys that were committed and subsequently deleted.
Insecure code patterns: dangerouslySetInnerHTML with unsanitized input, eval(), prototype pollution sinks.
Authentication logic review: LLM-assisted analysis of auth flows for common bypass patterns.
Report Design and User Experience
User Flow
User pastes a URL into the web form.
System creates a scan job and returns a real-time status page with progress indicators per check category.
Scan completes (typical: 60–90 seconds for passive tier). User receives the report.
Report opens to a dashboard view: overall security grade (A–F), severity distribution chart, and a prioritized findings list.
Each finding expands to show: plain-English explanation, evidence (redacted screenshots or code snippets), impact statement, and the fix section.
Fix section contains: step-by-step instructions for manual fix AND a one-click-copy AI prompt tailored to the detected stack (e.g., “Paste this into Cursor”).
Finding Schema
Every finding normalizes into a consistent data structure:
severity: CRITICAL | HIGH | MEDIUM | LOW | INFO
category: one of the P1-01 through P1-15 check categories
location: specific URL, file path, header, or storage key where the issue was found
evidence: the exact string, header value, or configuration observed (secrets are redacted to first/last 4 characters)
explanation: 2–3 sentence plain-English description of what this means and why it matters
impact: what an attacker could do with this finding
fix_manual: step-by-step remediation instructions
fix_ai_prompt: paste-ready prompt for Cursor/Lovable/Bolt/v0 to fix the issue
detected_stack: framework/platform detected (Next.js, Vite, CRA, Vercel, Netlify, etc.) to tailor the fix prompt
Report Formats
Web dashboard: interactive, expandable findings, sharable via unique URL.
PDF export: branded, suitable for sending to a cofounder, investor, or client.
White-label PDF (Agency tier): agency branding replaces VibeSafe branding.
JSON API response (Pro+ tiers): machine-readable for CI/CD integration.
AI/LLM Integration Strategy
Where LLMs Add Value
Severity classification with reasoning: LLM contextualizes why a specific finding matters for this particular site (e.g., an exposed Stripe key on an e-commerce site is more critical than on a portfolio page).
Plain-English explanation generation: translate technical findings into language a non-engineer understands.
Fix prompt tailoring: detect the user’s stack from passive signals (framework fingerprint, hosting platform headers, build tool signatures) and generate remediation prompts specific to their tooling.
API response analysis: identify sensitive data leakage in API responses where regex is too brittle (e.g., “this /api/users endpoint returns other users’ email addresses”).
Report summarization: generate a 3-sentence executive summary for the dashboard header.
Where LLMs Must Not Be Primary
Secret detection: regex + entropy is more accurate and 1000x cheaper. LLMs hallucinate keys that don’t exist and miss obvious ones.
Vulnerability determination without deterministic signal: the LLM must never be the sole basis for a finding. Every LLM-surfaced issue must have a deterministic precondition.
Exploit payload generation: published payload corpora are more reliable. LLM-generated payloads are inconsistent.
Hallucination Mitigation
The asymmetry of errors in security tooling demands conservative calibration. A false positive (phantom vulnerability) is worse than a false negative (missed real vulnerability) because false positives destroy the user’s trust in the tool and lead to alert fatigue. LLM outputs are always secondary to deterministic signals and are flagged as “AI-assisted analysis” in the report when the LLM contributed to the finding.
Pricing Strategy
Tier
Price
Includes
Target Segment
Scan Limit
Free
$0
1 scan/month, top 5 findings only, no fix prompts, watermarked report
Viral loop / trial
1/month
One-Shot
$29
Full report, all findings, AI fix prompts, 30-day re-scan window
Indie hacker pre-launch
1 + re-scans
Pro
$49/month
Weekly scans for up to 3 sites, full reports, scan history + diff, priority queue
SaaS founders
12/month
Studio
$199/month
Unlimited scans, unlimited sites, white-label PDF, API access, agency dashboard
Agencies / freelancers
Unlimited

Alternative agency pricing: $9/scan with no commitment for agencies with lumpy volume. Both models are offered; market data from first 100 customers determines which to emphasize.
Geographic pricing: INR pricing for Indian market should be a separate ladder (approximately 40–50% of USD pricing), not a direct conversion.
Competitive Landscape
Category
Examples
Strengths
Gaps for Our Audience
Our Positioning
Free Single-Purpose
Mozilla Observatory, SSL Labs, SecurityHeaders.com
Free, trusted, high accuracy in narrow scope
Single check each; no aggregation; no remediation
We aggregate + add fix prompts
Open-Source DAST
OWASP ZAP, Nuclei, Nikto
Comprehensive detection; extensible
Requires CLI; reports for security engineers
We’re the UI layer they’ll never build
SMB Commercial
Detectify, Probely, Intruder.io
Full-featured; continuous monitoring
$200–$500/month; assume security person on staff
We’re 75–90% cheaper, simpler
Enterprise
Snyk, Veracode, Checkmarx, Burp Enterprise
Deep SAST/DAST; CI integration
$5K–$50K/year; sales-led; irrelevant to segment
Different market entirely
Adjacent / Partial
GitGuardian, Snyk Free Tier
Excellent secret scanning (git-focused)
Requires GitHub; not URL-based; aimed at devs
We scan the deployed site, not the repo

Key differentiator: no competitor currently offers “security findings as AI coding tool prompts.” This is the natural interface for the vibe-coding audience and represents our primary moat until the AI coding tools themselves add native security checks.
Risks and Mitigations
Risk
Impact
Mitigation
Likelihood
Owner
Malicious users weaponize scanner against sites they don’t own
Legal liability; abuse complaints; reputation damage
Phase 1 is passive-only (no different from visiting in a browser). Phase 2 requires domain verification.
HIGH
Engineering + Legal
Scanner infrastructure targeted by attackers (SSRF, command injection)
Compromise of scanner; lateral movement to customer data
Sandboxed workers; network egress controls; no scanner-controlled URL following without domain allowlist
MEDIUM
Engineering
AI coding tools add native security checks, eliminating the need
Market erosion over 12–24 months
Position as independent third-party audit; pursue integration partnerships (plugin for Cursor/Lovable)
MEDIUM
Product + BD
False positives destroy user trust
Churn; negative word-of-mouth in small community
Conservative calibration; deterministic signals as primary; LLM as secondary only; beta program for calibration
MEDIUM
Engineering
Legal exposure from scanning without authorization in certain jurisdictions
Lawsuits; regulatory action
Phase 1 observes only public data. Legal review before Phase 2 launch. Terms of Service require user attestation of ownership.
LOW
Legal
Success Metrics
Launch Metrics (First 90 Days)
500+ free scans completed
50+ paid scans (One-Shot or Pro)
Net Promoter Score > 40 from post-scan survey
< 5% false positive rate on CRITICAL/HIGH findings
Average scan completion time < 90 seconds
Growth Metrics (Months 4–12)
Monthly recurring revenue from Pro + Studio tiers exceeding $5,000
3+ agency customers on Studio tier
Scan-to-share rate > 20% (users sharing their report URL)
Repeat scan rate > 30% (users returning to re-scan after fixing findings)
Open Questions for Discovery
Should the free tier require email signup, or allow anonymous scans to maximize viral reach? Trade-off: attribution for marketing vs. friction reduction.
Should reports include a public badge/seal (“Scanned by VibeSafe — Grade A”) users can embed on their site? Trade-off: viral growth vs. potential liability if a graded site is subsequently breached.
What is the right cadence for the Pro tier’s automated scans—weekly, daily, or on-deploy via webhook?
Should Phase 2 (active testing) be a separate product/pricing tier, or an upgrade within existing tiers?
How aggressively should the product surface findings from CT log subdomain enumeration, given that some findings may belong to different organizational units?