# Public-claim rules

One-page style guide for any text that ends up in a place a customer, investor, journalist, or skeptical security/legal/accessibility reviewer might read. That includes:

- `README.md`
- The landing page (`src/app/landing-hero.tsx`)
- Pricing (`src/app/pricing/page.tsx`)
- All pages under `src/app/` and `src/app/docs/`
- Marketing copy on social channels
- Sales decks, investor decks, one-pagers
- Press / blog posts
- Vision and pillar documents in `docs/`

**The rule of thumb:** every claim either (a) maps to a specific file in `src/lib/scanner/modules/` or `src/lib/llm/`, or (b) is labelled as "design target" / "future" / "vision" in a way that no reader could misread.

---

## The five rules

### 1. Regulatory / compliance terminology

**Never use "compliance", "compliant", or "attestation"** for any check without a documented attestation process behind it.

**Never use regulatory acronyms** — GDPR, CCPA, HIPAA, PCI-DSS, SOC 2, ADA, Section 508 — in public copy unless we can defend the specific checks against the specific statute or framework, with a docs page that names which clauses are evaluated and by which module.

**Examples:**
- ❌ "WCAG 2.2 Level AA — Legal compliance checking"
- ✅ "WCAG 2.2 AA criteria — subset evaluated via Lighthouse's accessibility audit"
- ❌ "GDPR compliance verified"
- ✅ "Cookie security flags checked", "Privacy policy presence checked"
- ❌ "We're SOC 2 ready"
- ✅ silence — say nothing at all about SOC 2 until we've actually been audited
- ❌ "Stay legally compliant"
- ✅ silence — that's the customer's lawyer's job, not ours

The acronyms are legally and reputationally loaded. Using them implies an attestation pipeline (auditor, evidence trail, periodic review). We don't have one. The cost of using them and being wrong is bigger than the marketing benefit of using them and being right.

### 2. "AI-powered" framing

**Never use "AI-powered" for deterministic logic with an AI cosmetic layer.**

Our scanner is deterministic. The AI layer (Claude) only:
- rewords findings into plain English explanations, and
- generates copy-paste fix prompts for the user's AI coding tool.

The prompt explicitly forbids invention; the AI is not detecting anything. So:

- ❌ "AI-powered scanning"
- ❌ "Our AI finds vulnerabilities"
- ✅ "AI explains findings in plain English"
- ✅ "AI generates ready-to-paste fix prompts"
- ✅ "AI-assisted remediation"

If at some point we genuinely add an AI-driven detection step (not just enrichment), this rule reopens — but only after `AI_QUALITY.md` exists with measured accuracy / hallucination metrics.

### 3. Numbers

**Capacity, performance, and accuracy numbers cite measured data or are labelled "design target".**

- ❌ "10,000 scans/day, 1,000 concurrent users" with no load test
- ✅ "Design target: 10,000 scans/day (not yet load-tested)"
- ❌ "<90 second scans"
- ✅ "Average scan time on the home page hero: pulled from `/api/v1/stats/scan-count` live data" / measured p95 from production Sentry
- ❌ "94% AI accuracy"
- ✅ silence — until the Phase 4.1 eval harness publishes a number we can cite
- ❌ "4,247 sites scanned this week" (hardcoded)
- ✅ value from `/api/v1/stats/scan-count` with a `—` placeholder on fetch failure

Marketing pulse numbers (counter widgets, "join 2,000 developers", etc.) need a real backing query or come out entirely.

### 4. Feature claims map to code

**Every "what we check" bullet maps to a specific module file.**

Before adding a bullet to README's "What's Included" or to `landing-hero.tsx` FEATURE_CARDS, point at the file:

| Bullet | Source file |
|--------|-------------|
| "Client-side secret exposure" | `src/lib/scanner/modules/p1-01-secrets.ts` |
| "Missing security headers" | `src/lib/scanner/modules/p1-03-headers.ts` |
| "Subdomain takeover detection" | `src/lib/scanner/modules/p1-11-subdomain-takeover.ts` |
| etc. | |

If you can't point at a file, the bullet doesn't ship until the module does. **Roadmap items go in a "Coming soon" row** of the comparison table, never in the "What's Included" list.

### 5. Vision vs ship

**Vision docs are clearly marked as vision.**

Files in `docs/` that describe future state (`VISION.md`, `VISION_SUMMARY.md`, `COMPLIANCE_VISION_SUMMARY.md`, anything in `docs/specs/`) carry a top-of-file banner stating "this describes long-term direction, not what ships today". Without that banner, a skeptical reviewer mistakes the doc for a current-state inventory and we lose trust.

Conversely, `README.md` and customer-facing pages describe **only what ships today**. Don't sprinkle "in our 5-pillar vision…" into the landing page.

---

## PR checklist hook

Any PR that adds or modifies public-facing copy should include in its description:

```
Public-claim audit:
- [ ] New claims map to a specific file in src/lib/ (or are removed)
- [ ] No regulatory acronyms without a backing module + attestation pipeline
- [ ] No "AI-powered" applied to deterministic logic
- [ ] Numbers either measured or labelled "design target"
- [ ] Vision-tense copy lives only in vision docs with the standard banner
```

Reviewer rejects the PR if any box is unticked or unjustified.

---

## How this doc gets enforced

The rule is informal today — PR review + author discipline. If `BUILD_PHASE.md` Phase 4.5 lands the broader audit and these still slip, the next escalation is a CI lint that greps for the banned terms in `src/app/`, `README.md`, and `docs/` (excluding vision docs by path).

Maintain this file in lockstep with what we actually claim. If a real attestation pipeline ships, rule 1 relaxes for the specific frameworks attested. If the AI gets a measured detection step, rule 2 relaxes with citation. Update the file, link the PR, communicate the change.

**Cross-reference:** `BUILD_PHASE.md` Phase 2.5 (mini), Phase 4.5 (full audit).
