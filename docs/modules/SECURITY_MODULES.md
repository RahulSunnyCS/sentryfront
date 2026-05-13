# Security Modules Documentation

**VibeSafe Security Scanner - Complete Module Reference**  
**Last Updated:** 2026-05-13  
**Total Modules:** 15

---

## Overview

This document details all 15 security modules in VibeSafe's scanning engine. For each module, we document:

1. **What We Check** - The specific security issue being detected
2. **How We Check** - Technical detection methodology
3. **False Positives** - Common scenarios that trigger incorrect alerts
4. **Improvements** - Planned enhancements to detection accuracy

---

## Module Index

| ID | Module Name | Severity | Category |
|----|-------------|----------|----------|
| P1-01 | Client-Side Secrets | CRITICAL | Exposure |
| P1-02 | Source Map Exposure | HIGH | Exposure |
| P1-03 | Security Headers | HIGH | Configuration |
| P1-04 | TLS/SSL Configuration | CRITICAL | Encryption |
| P1-05 | Cookie Security | HIGH | Session Management |
| P1-06 | Sensitive Path Exposure | HIGH | Information Disclosure |
| P1-07 | CORS Misconfiguration | MEDIUM | Cross-Origin |
| P1-08 | Mixed Content | MEDIUM | Encryption |
| P1-09 | Third-Party Scripts | MEDIUM | Supply Chain |
| P1-10 | DNS/Email Security | LOW | Email Spoofing |
| P1-11 | Subdomain Takeover | HIGH | Domain Hijacking |
| P1-12 | Error Disclosure | MEDIUM | Information Leakage |
| P1-13 | Dev Interfaces | HIGH | Exposure |
| P1-14 | Robots.txt Analysis | LOW | Information Disclosure |
| P1-15 | Cache Control | MEDIUM | Privacy |

---

## P1-01: Client-Side Secrets Detection

### What We Check

Scans HTML, JavaScript bundles, and source maps for **hardcoded secrets** that should never be exposed to clients:

- API keys (AWS, Stripe, SendGrid, etc.)
- OAuth tokens (GitHub, Google, etc.)
- Database credentials
- Private keys (RSA, JWT signing keys)
- Encryption keys
- Service account credentials

**Risk:** Attackers can steal these secrets and use them to:
- Access your cloud infrastructure
- Charge your payment accounts
- Read/modify databases
- Impersonate your application

---

### How We Check

**1. Pattern Matching (700+ Regex Patterns)**

```typescript
const SECRET_PATTERNS = [
  {
    name: "AWS Access Key",
    regex: /AKIA[0-9A-Z]{16}/,
    severity: "CRITICAL"
  },
  {
    name: "Stripe Secret Key",
    regex: /sk_live_[0-9a-zA-Z]{24,}/,
    severity: "CRITICAL"
  },
  {
    name: "GitHub Personal Access Token",
    regex: /ghp_[0-9a-zA-Z]{36}/,
    severity: "CRITICAL"
  },
  {
    name: "JWT with HS256",
    regex: /eyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*/,
    severity: "HIGH"
  },
  // ... 696 more patterns
];
```

**2. Entropy Analysis**

For strings that don't match known patterns, we calculate **Shannon entropy** to detect random-looking strings (likely secrets):

```typescript
const calculateEntropy = (str: string): number => {
  const len = str.length;
  const frequencies: Record<string, number> = {};
  
  for (const char of str) {
    frequencies[char] = (frequencies[char] || 0) + 1;
  }
  
  let entropy = 0;
  for (const freq of Object.values(frequencies)) {
    const p = freq / len;
    entropy -= p * Math.log2(p);
  }
  
  return entropy;
};

// Flag strings with entropy > 4.5 (high randomness)
if (entropy > 4.5 && str.length > 20) {
  findings.push({ title: "Potential secret detected" });
}
```

**3. Context-Aware Filtering**

We reduce false positives by checking context:

```typescript
// Don't flag if:
- Inside HTML comments: <!-- secret -->
- In test files: __tests__/
- Demo/example keys: "sk_test_", "pk_test_"
- Environment variable names: process.env.API_KEY (not the value)
```

---

### False Positives

**Common False Positives:**

1. **Test/Demo Keys**
   - Example: `AKIA0000000000000000` (AWS example key)
   - **Fix:** Filter out known demo keys

2. **Base64-Encoded Images**
   - Example: `data:image/png;base64,iVBORw0KG...`
   - **Fix:** Exclude data URIs from scanning

3. **Hash Values** (SHA-256, etc.)
   - Example: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
   - **Fix:** Distinguish between hashes (deterministic) and secrets (random)

4. **Public API Keys**
   - Example: Stripe publishable keys (`pk_live_...`)
   - **Fix:** Whitelist known "safe" key prefixes

**Current False Positive Rate:** ~3-5% (validated against 1,000+ test sites)

---

### Improvements

**Planned Enhancements:**

1. **Machine Learning Model**
   - Train classifier on 100K labeled examples
   - Improve entropy-based detection
   - Target: <1% false positive rate

2. **Secret Verification**
   - Actually test keys (e.g., call AWS STS with found AKIA key)
   - Confirm if secret is valid and active
   - Increase severity if verified

3. **Source Mapping**
   - Show exact file/line number where secret appears
   - Requires parsing source maps

4. **Historical Tracking**
   - Alert if secret was recently committed (Git integration)
   - Check against GitHub's secret scanning database

---

## P1-02: Source Map Exposure

### What We Check

Detects if **JavaScript source maps** (`.map` files) are publicly accessible.

**Risk:** Source maps reveal:
- Original unminified code (business logic)
- Internal API endpoints
- Algorithm implementations
- Comments with TODOs/FIXMEs
- Third-party library versions (easier to exploit)

---

### How We Check

**1. Check HTML for `.map` references**

```typescript
const scriptTags = html.match(/<script[^>]+src="([^"]+)"/g);

for (const tag of scriptTags) {
  const jsUrl = extractSrc(tag);
  const mapUrl = jsUrl + ".map";
  
  const response = await fetch(mapUrl);
  
  if (response.ok) {
    findings.push({
      severity: "HIGH",
      title: "Source map publicly accessible",
      location: mapUrl,
      evidence: "Source map found at " + mapUrl
    });
  }
}
```

**2. Check JS files for `sourceMappingURL` comments**

```typescript
const jsContent = await fetch(jsUrl).then(r => r.text());

if (jsContent.includes("//# sourceMappingURL=")) {
  const mapPath = extractMapPath(jsContent);
  // Check if accessible...
}
```

---

### False Positives

**Common False Positives:**

1. **Development Environments**
   - Source maps are fine on `dev.example.com` or `localhost`
   - **Fix:** Only flag on production domains

2. **Open-Source Projects**
   - Some OSS apps intentionally expose source
   - **Fix:** Add "dismiss" option in UI

**Current False Positive Rate:** <1%

---

### Improvements

1. **Smart Detection**
   - Check if source map contains sensitive code (API keys, internal URLs)
   - Only flag if leaking valuable information

2. **Build Tool Integration**
   - Provide Next.js/Vite config snippets to disable source maps in prod

---

## P1-03: Security Headers

### What We Check

Verifies presence and correct configuration of **11 critical security headers**:

| Header | Purpose | Recommended Value |
|--------|---------|-------------------|
| Content-Security-Policy | Prevent XSS | `default-src 'self'` |
| Strict-Transport-Security | Force HTTPS | `max-age=31536000; includeSubDomains` |
| X-Content-Type-Options | Prevent MIME sniffing | `nosniff` |
| X-Frame-Options | Prevent clickjacking | `DENY` or `SAMEORIGIN` |
| X-XSS-Protection | Browser XSS filter | `1; mode=block` |
| Referrer-Policy | Control referer | `strict-origin-when-cross-origin` |
| Permissions-Policy | Limit features | `geolocation=(), microphone=()` |
| Cross-Origin-Embedder-Policy | Isolation | `require-corp` |
| Cross-Origin-Opener-Policy | Isolation | `same-origin` |
| Cross-Origin-Resource-Policy | Isolation | `same-origin` |
| Cache-Control | Prevent caching sensitive data | `no-store` (for auth pages) |

---

### How We Check

```typescript
const checkSecurityHeaders = (headers: Record<string, string>) => {
  const findings: Finding[] = [];
  
  // 1. Content-Security-Policy
  if (!headers["content-security-policy"]) {
    findings.push({
      severity: "HIGH",
      title: "Missing Content-Security-Policy header",
      location: "HTTP Response Headers",
      evidence: "No CSP header found",
      impact: "Site vulnerable to XSS attacks",
      fixManual: ["Add CSP header to server config"],
      fixAiPrompt: "Add Content-Security-Policy header..."
    });
  } else {
    // Validate CSP directives
    const csp = headers["content-security-policy"];
    
    if (csp.includes("'unsafe-inline'")) {
      findings.push({
        severity: "MEDIUM",
        title: "CSP allows unsafe-inline scripts",
        evidence: csp,
        impact: "Reduces XSS protection"
      });
    }
  }
  
  // 2. Strict-Transport-Security
  if (!headers["strict-transport-security"]) {
    findings.push({
      severity: "HIGH",
      title: "Missing HSTS header",
      impact: "Users vulnerable to SSL stripping attacks"
    });
  }
  
  // ... check remaining 9 headers
  
  return findings;
};
```

---

### False Positives

1. **Static Sites** (no backend)
   - Can't set headers without server/CDN config
   - **Fix:** Detect static hosting (GitHub Pages, Netlify) and lower severity

2. **Iframes Intentionally Used**
   - X-Frame-Options: DENY breaks embeds
   - **Fix:** Suggest `SAMEORIGIN` instead

**Current False Positive Rate:** <2%

---

### Improvements

1. **Context-Aware Recommendations**
   - Detect framework (Next.js, Nuxt) and provide framework-specific config
   - Example: For Next.js, show `next.config.js` snippet

2. **CSP Builder**
   - Interactive tool to generate CSP based on detected resources
   - Analyze actual scripts/styles loaded and build minimal CSP

---

## P1-04: TLS/SSL Configuration

### What We Check

- TLS version (must be 1.2 or 1.3)
- Certificate validity and expiration
- Certificate chain completeness
- Weak cipher suites
- Certificate issuer trust
- HTTPS redirect (HTTP → HTTPS)

---

### How We Check

```typescript
// 1. Check TLS version
const tlsInfo = await checkTLS(url);

if (tlsInfo.version < "TLSv1.2") {
  findings.push({
    severity: "CRITICAL",
    title: "Outdated TLS version",
    evidence: `Using ${tlsInfo.version}`,
    impact: "Vulnerable to POODLE, BEAST attacks"
  });
}

// 2. Certificate expiration
const cert = tlsInfo.certificate;
const daysUntilExpiry = (cert.validTo - Date.now()) / (1000 * 60 * 60 * 24);

if (daysUntilExpiry < 30) {
  findings.push({
    severity: "HIGH",
    title: "SSL certificate expiring soon",
    evidence: `Expires in ${daysUntilExpiry} days`
  });
}

// 3. HTTP redirect
const httpResponse = await fetch(url.replace("https://", "http://"));
if (httpResponse.status !== 301 && httpResponse.status !== 308) {
  findings.push({
    severity: "MEDIUM",
    title: "No HTTP to HTTPS redirect",
    impact: "Users may access site over insecure HTTP"
  });
}
```

---

### False Positives

1. **Local Development** (self-signed certs)
   - **Fix:** Skip TLS checks for localhost/127.0.0.1

2. **Certificate Renewal in Progress**
   - Cert shows "expires in 1 day" but is being renewed
   - **Fix:** Check if new cert is already issued (dual cert setup)

**Current False Positive Rate:** <1%

---

### Improvements

1. **Cipher Suite Analysis**
   - Detect weak ciphers (RC4, 3DES)
   - Recommend modern cipher suites

2. **CAA Record Check**
   - Verify DNS CAA records exist (prevent unauthorized cert issuance)

---

## P1-05 through P1-15: Quick Reference

### P1-05: Cookie Security

**Checks:**
- `Secure` flag on all cookies (HTTPS only)
- `HttpOnly` flag (no JavaScript access)
- `SameSite=Strict` or `Lax` (CSRF protection)

**False Positives:** Functional cookies (analytics, prefs) don't need `HttpOnly`

---

### P1-06: Sensitive Path Exposure

**Checks:**
- `/admin`, `/.env`, `/.git`, `/config.json`
- Returns 200 OK = exposed

**False Positives:** Public `/admin/login` pages (not actual admin panel)

---

### P1-07: CORS Misconfiguration

**Checks:**
- `Access-Control-Allow-Origin: *` with credentials
- Reflected origin in ACAO header
- Overly permissive origins

**False Positives:** Public APIs intentionally allow `*`

---

### P1-08: Mixed Content

**Checks:**
- HTTP resources loaded on HTTPS page
- Images, scripts, stylesheets, iframes

**False Positives:** Browsers auto-upgrade some resources

---

### P1-09: Third-Party Scripts

**Checks:**
- Google Analytics, Facebook Pixel, etc.
- Checks for SRI (Subresource Integrity)

**False Positives:** All external scripts flagged (user must decide risk)

---

### P1-10: DNS/Email Security

**Checks:**
- SPF record exists (`v=spf1...`)
- DKIM configured
- DMARC policy (`p=quarantine` or `p=reject`)

**False Positives:** Domains not sending email (SPF not needed)

---

### P1-11: Subdomain Takeover

**Checks:**
- DNS CNAME points to unclaimed service (AWS, Heroku, etc.)
- Returns 404 or "no such app"

**False Positives:** Temporary downtime flagged as takeover

---

### P1-12: Error Disclosure

**Checks:**
- Stack traces in HTML
- Database errors (SQL syntax)
- Framework error pages (Django, Laravel)

**False Positives:** Development environments (intentional)

---

### P1-13: Dev Interfaces Exposure

**Checks:**
- GraphQL playground (`/graphql`)
- Swagger/OpenAPI docs (`/api/docs`)
- phpMyAdmin, Adminer

**False Positives:** Public APIs with docs (intentional)

---

### P1-14: Robots.txt Analysis

**Checks:**
- Disallowed paths that reveal structure
- Example: `Disallow: /admin` → tells attackers admin exists

**False Positives:** All robots.txt flagged (informational only)

---

### P1-15: Cache Control

**Checks:**
- Sensitive pages (login, checkout) have `Cache-Control: no-store`
- Static assets have long cache times

**False Positives:** Some frameworks handle this automatically

---

## Summary

### Detection Accuracy

| Metric | Target | Current | Year 2 Goal |
|--------|--------|---------|-------------|
| False Positive Rate | <5% | 3-5% | <1% |
| False Negative Rate | <2% | Unknown | <0.5% |
| Detection Coverage | 90% | 85% | 95% |

### Performance

- **Average scan time:** 10-20 seconds
- **Modules run:** Parallel (all 15 simultaneously)
- **Resource usage:** <200MB RAM, <1 CPU core

### Roadmap

**Q2 2026:**
- ML-based secret detection
- Framework-specific recommendations
- Interactive CSP builder

**Q3 2026:**
- Secret verification (test if keys work)
- Historical tracking (Git integration)
- Custom rule engine

---

**Document Owner:** Security Team
**Next Review:** 2026-06-01
**Questions?** File issues in GitHub or email security@vibesafe.app
