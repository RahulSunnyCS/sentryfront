# Subprocessor Register

**Version:** 1.0  
**Effective Date:** 2026-05-11  
**Last Updated:** 2026-05-11

This register lists all third-party subprocessors that process customer data on behalf of VibeSafe, as required by GDPR Article 28.

---

## 1. Active Subprocessors

| Subprocessor | Purpose | Data Categories | Data Location | Certification / Compliance | DPA Available | Opt-Out Possible |
|--------------|---------|-----------------|---------------|----------------------------|---------------|------------------|
| **Vercel Inc.** | Hosting, serverless functions, edge network | Account data, scan results, logs, session data | US (primary), EU regions available | SOC 2 Type II, ISO 27001, GDPR | ✅ Yes (built-in) | ❌ No (core infrastructure) |
| **Neon (Neon Database Inc.)** | PostgreSQL database hosting | All database records (users, scans, findings) | US (primary), EU regions available | SOC 2 Type II, GDPR | ✅ Yes | ❌ No (core infrastructure) |
| **Stripe Inc.** | Payment processing, subscription management | Payment method, billing address, transaction history | US, EU | PCI-DSS Level 1, SOC 2, GDPR, EU-US DPF | ✅ Yes (automatic) | ❌ No (payments required) |
| **Anthropic PBC** | LLM API (AI enrichment of findings) | **Redacted findings** (no full secrets, PII minimized) | US | SOC 2 Type II (in progress), GDPR-aware | ✅ Enterprise only | ✅ Yes (disable LLM enrichment in settings) |
| **Sentry (Functional Software Inc.)** | Error tracking, performance monitoring | Error logs, stack traces, user IDs, session replays | US, EU regions available | SOC 2 Type II, ISO 27001, GDPR, EU-US DPF | ✅ Yes | ⚠️ Partial (required for production, can disable session replay) |
| **Cloudflare Inc.** | Object storage (R2), CDN | PDF reports, screenshots, crawl artifacts | Global (data residency configurable) | SOC 2 Type II, ISO 27001, GDPR, EU-US DPF | ✅ Yes | ❌ No (core infrastructure) |
| **Redis Labs / Upstash** | In-memory caching, job queue (BullMQ) | Session cache, scan queue metadata, rate limit counters | US, EU regions available | SOC 2, ISO 27001, GDPR | ✅ Yes | ⚠️ Partial (can fall back to in-memory queue for dev) |
| **GitHub (Microsoft)** | OAuth authentication (optional) | Email, name, profile photo (if user chooses GitHub login) | US, EU | SOC 2, ISO 27001, GDPR, EU-US DPF | ✅ Yes (Microsoft DPA) | ✅ Yes (use email/password or Google instead) |
| **Google LLC** | OAuth authentication (optional) | Email, name, profile photo (if user chooses Google login) | US, EU | SOC 2, ISO 27001, GDPR, EU-US DPF | ✅ Yes (Google Cloud DPA) | ✅ Yes (use email/password or GitHub instead) |

---

## 2. Data Flow Diagram

```
┌──────────────────┐
│   User Browser   │
└────────┬─────────┘
         │ HTTPS (TLS 1.2+)
         ▼
┌──────────────────────────────────────────────────────────┐
│              Vercel Edge Network (CDN)                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │          Next.js App (Frontend + API Routes)       │  │
│  └───────┬────────────────────────────────────────────┘  │
└──────────┼───────────────────────────────────────────────┘
           │
           ├─► PostgreSQL (Neon) ──────► User data, scan results
           │
           ├─► Redis (Upstash) ────────► Session cache, job queue
           │
           ├─► Cloudflare R2 ──────────► PDF reports, screenshots
           │
           ├─► Stripe API ─────────────► Payment processing
           │
           ├─► Anthropic API ──────────► LLM enrichment (optional)
           │
           ├─► Sentry API ─────────────► Error logs
           │
           └─► OAuth Providers ────────► GitHub, Google (optional)
               (GitHub, Google)
```

---

## 3. Subprocessor Details

### 3.1 Vercel Inc.
- **Website:** https://vercel.com
- **Privacy Policy:** https://vercel.com/legal/privacy-policy
- **DPA:** https://vercel.com/legal/dpa
- **Data Residency:** US (default), EU regions available for Enterprise
- **Retention:** Per customer configuration
- **Security:** SOC 2 Type II, ISO 27001, encryption at rest/transit
- **Transfer Mechanism:** EU-US Data Privacy Framework, Standard Contractual Clauses

### 3.2 Neon (Neon Database Inc.)
- **Website:** https://neon.tech
- **Privacy Policy:** https://neon.tech/privacy-policy
- **DPA:** Available on request for paid plans
- **Data Residency:** US (default), EU regions available
- **Retention:** Per customer configuration, backups retained 30 days
- **Security:** SOC 2 Type II, encryption at rest (AES-256), in transit (TLS 1.2+)
- **Transfer Mechanism:** Standard Contractual Clauses

### 3.3 Stripe Inc.
- **Website:** https://stripe.com
- **Privacy Policy:** https://stripe.com/privacy
- **DPA:** https://stripe.com/legal/dpa (automatic for EU customers)
- **Data Residency:** US, EU (automatically routes EU customers to EU infrastructure)
- **Retention:** Per PCI-DSS and tax compliance requirements (7 years for transaction history)
- **Security:** PCI-DSS Level 1, SOC 2, ISO 27001
- **Transfer Mechanism:** EU-US Data Privacy Framework, Standard Contractual Clauses

### 3.4 Anthropic PBC
- **Website:** https://www.anthropic.com
- **Privacy Policy:** https://www.anthropic.com/legal/privacy
- **Commercial Terms:** https://www.anthropic.com/legal/commercial-terms
- **DPA:** Available for Enterprise customers (contact Anthropic)
- **Data Residency:** US (Claude API hosted in AWS US regions)
- **Retention:** 
  - Default: 30 days (for abuse monitoring)
  - Zero-retention: Available for Enterprise customers (contact Anthropic sales)
- **Training:** Anthropic does NOT train on API data unless explicitly opted in
- **Security:** SOC 2 Type II (in progress as of May 2026), encryption in transit
- **Transfer Mechanism:** Standard Contractual Clauses (available on request)
- **VibeSafe Safeguards:** 
  - ✅ All secrets redacted before sending to Anthropic
  - ✅ Can be disabled per-user (opt-out)
  - ✅ Only redacted findings sent (no full crawl data, credentials, or PII)

### 3.5 Sentry (Functional Software Inc.)
- **Website:** https://sentry.io
- **Privacy Policy:** https://sentry.io/privacy/
- **DPA:** https://sentry.io/legal/dpa/
- **Data Residency:** US (default), EU region available
- **Retention:** 30 days for error events (configurable)
- **Security:** SOC 2 Type II, ISO 27001, encryption at rest/transit
- **Transfer Mechanism:** EU-US Data Privacy Framework, Standard Contractual Clauses
- **VibeSafe Configuration:**
  - ✅ Session replay disabled (privacy concern)
  - ✅ PII scrubbing enabled (emails, IPs redacted)
  - ✅ Source maps uploaded for debugging but not publicly accessible

### 3.6 Cloudflare Inc.
- **Website:** https://www.cloudflare.com
- **Privacy Policy:** https://www.cloudflare.com/privacypolicy/
- **DPA:** https://www.cloudflare.com/cloudflare-customer-dpa/
- **Data Residency:** Global (configurable, can enforce EU-only storage)
- **Retention:** Per customer configuration (R2 lifecycle policies)
- **Security:** SOC 2, ISO 27001, encryption at rest (AES-256)
- **Transfer Mechanism:** EU-US Data Privacy Framework, Standard Contractual Clauses
- **VibeSafe Configuration:**
  - ✅ Private buckets (no public access)
  - ✅ Signed URLs with 1-hour expiry
  - ✅ Auto-deletion of crawl artifacts after 7 days (S3 lifecycle policy)

### 3.7 Redis Labs / Upstash
- **Website:** https://upstash.com (or https://redis.com)
- **Privacy Policy:** https://upstash.com/privacy
- **DPA:** Available on request
- **Data Residency:** US, EU regions available
- **Retention:** Ephemeral (in-memory cache), no persistent storage of customer data
- **Security:** Encryption in transit (TLS 1.2+), optional encryption at rest
- **Transfer Mechanism:** Standard Contractual Clauses
- **VibeSafe Configuration:**
  - ✅ Session cache only (no PII beyond user ID)
  - ✅ Job queue metadata (scan IDs, status)
  - ✅ Rate limit counters (IP addresses, hashed)

### 3.8 GitHub (Microsoft Corporation)
- **Website:** https://github.com
- **Privacy Policy:** https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement
- **DPA:** https://privacy.microsoft.com/en-us/dpa (Microsoft DPA covers GitHub)
- **Data Residency:** US, EU
- **Retention:** Per GitHub account lifecycle
- **Security:** SOC 2, ISO 27001
- **Transfer Mechanism:** EU-US Data Privacy Framework, Standard Contractual Clauses
- **VibeSafe Usage:** OAuth only (email, name, profile photo) — optional authentication method

### 3.9 Google LLC
- **Website:** https://cloud.google.com
- **Privacy Policy:** https://policies.google.com/privacy
- **DPA:** https://cloud.google.com/terms/data-processing-addendum
- **Data Residency:** US, EU, global
- **Retention:** Per Google Cloud retention policies
- **Security:** SOC 2, ISO 27001, ISO 27017, ISO 27018
- **Transfer Mechanism:** EU-US Data Privacy Framework, Standard Contractual Clauses
- **VibeSafe Usage:** OAuth only (email, name, profile photo) — optional authentication method

---

## 4. Change Management

### 4.1 Adding New Subprocessors
Before adding a new subprocessor:
1. ✅ Legal review of subprocessor's privacy policy and terms
2. ✅ Security assessment (SOC 2, ISO 27001, or equivalent)
3. ✅ DPA availability confirmation
4. ✅ Data residency and transfer mechanism review
5. ✅ Update this register
6. ✅ Notify Enterprise customers 30 days in advance (GDPR Article 28.2)

### 4.2 Notification to Customers
- **Enterprise customers:** 30-day notice before adding new subprocessors
- **Standard customers:** Notice via email or Privacy Policy update
- **Right to object:** Enterprise customers may object to new subprocessors (will work with customer to find alternative)

---

## 5. Review Schedule

- **Quarterly:** Review active subprocessors for compliance status
- **Annual:** Audit subprocessor security certifications (SOC 2, ISO 27001)
- **Ad-hoc:** Review if subprocessor has a data breach or changes terms

**Last reviewed:** 2026-05-11  
**Next review:** 2026-08-11

---

## 6. Contact

For subprocessor inquiries or DPA requests:
- **Email:** privacy@vibesafe.example
- **Enterprise DPA requests:** legal@vibesafe.example
