# Compliance Review for New Detection Modules

**Purpose**: Ensure all new security detection modules meet legal, privacy, and licensing requirements before merging to production.

**Required for**: Any new module in `src/lib/scanner/modules/`

---

## Module Intake Checklist

Complete this checklist BEFORE implementing a new detection module:

### 1. Scope and Authorization

- [ ] **Passive vs Active**: Is this module passive (analyzes public content) or active (sends probes)?
  - If active: Requires domain verification enforcement
  - If passive: Allowed for all scans

- [ ] **Third-party targets**: Does this module make requests to third-party services?
  - Examples: DNS lookups (crt.sh), npm registry, WHOIS, public APIs
  - If yes: Ensure rate limits and Terms of Service compliance

- [ ] **Authorization**: Could this module scan unauthorized targets?
  - If yes: Add gating logic and documentation

---

### 2. Rule and Pattern Provenance

- [ ] **Source of detection logic**: Where did the patterns/rules come from?
  - [ ] Original work (developed by VibeSafe team)
  - [ ] Public domain or CC0
  - [ ] Open-source project (specify license)
  - [ ] Third-party wordlist/database (requires attribution)

- [ ] **License compatibility**: If borrowed from another project:
  - [ ] License is MIT, Apache-2.0, BSD, CC0, or other permissive
  - [ ] NOT GPL, AGPL, or non-commercial
  - [ ] Attribution added to `docs/compliance/third-party-notices.md`

- [ ] **Proprietary sources**: Are any patterns from proprietary scanners?
  - If yes: DO NOT MERGE without legal review
  - Commercial scanner databases (Nessus, Burp, etc.) are copyrighted

---

### 3. Data Privacy and Redaction

- [ ] **Sensitive data detection**: Does this module detect:
  - [ ] API keys, secrets, passwords
  - [ ] Session tokens, JWTs
  - [ ] Credit card numbers, SSNs
  - [ ] Email addresses, phone numbers
  - [ ] Personal identifiable information (PII)

- [ ] **Redaction requirement**: If sensitive data is detected:
  - [ ] MUST redact BEFORE storing in database
  - [ ] MUST redact BEFORE sending to LLM
  - [ ] MUST redact BEFORE logging
  - [ ] Use `redact()` function: `[first 4]****[last 4]`

- [ ] **Regression test**: Add test case verifying redaction

---

### 4. Third-Party Service Dependencies

- [ ] **External API calls**: Does this module call external APIs?
  - Examples: crt.sh, npm registry, DNS resolvers, GitHub API
  
- [ ] **Rate limiting**: Are external API calls rate-limited?
  - [ ] Yes — implemented in module
  - [ ] N/A — no external calls

- [ ] **Caching**: Are responses cached to reduce API load?
  - [ ] Yes — TTL documented
  - [ ] N/A — no external calls

- [ ] **Terms of Service compliance**:
  - [ ] Read and comply with third-party API Terms
  - [ ] Respect rate limits and abuse policies
  - [ ] Add attribution if required

- [ ] **Subprocessor registration**: If new third-party service:
  - [ ] Add to `docs/compliance/subprocessor-register.md`
  - [ ] Document data shared, retention, DPA status

---

### 5. Performance and Resource Limits

- [ ] **Timeout enforcement**: Module respects scan timeout (120s global)
  - [ ] Network requests have individual timeouts (10s default)
  - [ ] Module can be interrupted gracefully

- [ ] **Resource limits**:
  - [ ] Network requests: ≤50 per scan
  - [ ] Data downloaded: ≤50 MB per scan
  - [ ] CPU usage: No blocking operations (use async/await)

- [ ] **Error handling**:
  - [ ] Module fails gracefully (returns empty findings on error)
  - [ ] Errors logged but scan continues
  - [ ] No unhandled promise rejections

---

### 6. Security and Safety

- [ ] **Injection risk**: Does module construct URLs, queries, or commands?
  - [ ] Yes — validated against injection (SSRF, command injection)
  - [ ] No — safe

- [ ] **Metadata endpoint blocking**: Module does NOT scan:
  - [ ] 169.254.169.254 (AWS/GCP/Azure metadata)
  - [ ] 127.0.0.1, localhost
  - [ ] Private IP ranges (RFC-1918)

- [ ] **Sensitive targets**: Module avoids:
  - [ ] Financial institutions (unless authorized)
  - [ ] Healthcare systems (HIPAA risk)
  - [ ] Government websites (unauthorized scanning illegal)
  - [ ] Critical infrastructure

---

### 7. Evidence and Reporting

- [ ] **Evidence quality**: Findings include:
  - [ ] Clear title
  - [ ] Severity (CRITICAL, HIGH, MEDIUM, LOW, INFO)
  - [ ] Location (URL, file path, line number)
  - [ ] Redacted evidence
  - [ ] Explanation (what this means)
  - [ ] Impact (business risk)
  - [ ] fixManual steps
  - [ ] fixAiPrompt (AI-ready)

- [ ] **False positive rate**: Expected FP rate documented
  - Target: <5% for CRITICAL/HIGH
  - If higher: Add confidence scoring or manual review flag

- [ ] **False negative awareness**: Known limitations documented

---

### 8. Testing

- [ ] **Unit tests**: Module has test coverage
  - [ ] True positive corpus (intentionally vulnerable sites)
  - [ ] False positive corpus (clean sites)
  - [ ] Edge cases (timeouts, network errors)

- [ ] **Redaction tests** (if detecting secrets):
  - [ ] Verify secrets redacted in findings.evidence
  - [ ] Verify no full secrets in logs
  - [ ] Verify no full secrets in LLM prompts

- [ ] **Integration tests**: Module runs in full scan pipeline

---

## Approval Process

### Step 1: Self-Review

Developer completes this checklist before opening PR.

### Step 2: Code Review

- Standard code review (functionality, TypeScript, style)
- Reviewer verifies checklist completed

### Step 3: Compliance Review (If Applicable)

Requires additional compliance review if ANY of these apply:

- [ ] Module is **active** (requires domain verification)
- [ ] Module calls **new third-party APIs** not in subprocessor register
- [ ] Module uses **third-party rules/databases** (licensing concern)
- [ ] Module detects **highly sensitive data** (CC numbers, SSNs, health data)
- [ ] Expected FP rate >10% for CRITICAL/HIGH

**Compliance Reviewer**: Engineering Lead or designated compliance officer

### Step 4: Merge

After approvals:
- [ ] Update `docs/compliance/third-party-notices.md` if new dependencies
- [ ] Update `docs/compliance/subprocessor-register.md` if new API
- [ ] Merge to `main`
- [ ] Deploy to staging and test end-to-end

---

## Example Compliance Reviews

### ✅ Good Example: P1-03 Headers Module

- **Passive**: ✅ Yes (only analyzes HTTP headers)
- **Provenance**: ✅ Original work based on public RFCs
- **Privacy**: ✅ No PII detected
- **External APIs**: ✅ None
- **Resource limits**: ✅ Instant (synchronous)
- **Compliance review**: ❌ Not required (straightforward)

---

### ⚠️ Requires Review: P1-11 Subdomain Takeover

- **Passive**: ✅ Yes (DNS queries only)
- **Provenance**: ⚠️ Fingerprints inspired by can-i-take-over-xyz (MIT license)
- **Privacy**: ✅ No PII detected
- **External APIs**: ⚠️ Yes — crt.sh (public certificate transparency log)
- **Resource limits**: ⚠️ Rate-limited to 10 req/scan
- **Compliance review**: ✅ Required — external API + third-party patterns
- **Actions**: 
  - Added crt.sh to subprocessor register
  - Documented fingerprint provenance
  - Added rate limiting and caching
- **Outcome**: ✅ Approved

---

### ❌ Rejected Example: Hypothetical CVE Database Scan

- **Passive**: ✅ Yes
- **Provenance**: ❌ Uses proprietary CVE database (paid license)
- **Privacy**: ✅ No PII
- **External APIs**: ❌ Requires paid API key
- **Compliance review**: ✅ Required
- **Actions**: 
  - Legal review rejected due to license incompatibility
  - Alternative: Use free NVD API or OSV.dev instead
- **Outcome**: ❌ Rejected, reimplement with free data source

---

## Module Compliance Log

Track all compliance reviews in this section:

| Module ID | Name | Review Date | Reviewer | Outcome | Notes |
|-----------|------|-------------|----------|---------|-------|
| P1-01 | Secrets | 2024-Q4 | Engineering | ✅ Approved | Original patterns |
| P1-11 | Subdomain Takeover | 2024-Q4 | Engineering | ✅ Approved | crt.sh added to subprocessors |
| ... | ... | ... | ... | ... | ... |

---

## Contact for Questions

**Compliance Officer**: engineering-lead@[DOMAIN].com  
**Legal Counsel**: legal@[DOMAIN].com (for licensing questions)

---

**Last Updated**: [TO BE DETERMINED]  
**Next Review**: Annually or when new module types added

---

**END OF MODULE COMPLIANCE REVIEW DOCUMENTATION**
