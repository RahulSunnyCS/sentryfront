# Subprocessor Register

**Last Updated**: [TO BE DETERMINED BEFORE LAUNCH]  
**Version**: 1.0

---

## Overview

This document lists all third-party service providers ("subprocessors") that process user data on behalf of VibeSafe. All subprocessors are required to maintain adequate data protection standards and have Data Processing Agreements (DPAs) in place.

**Note**: Subprocessors are only active when their respective features are enabled via environment variables. See [docs/phase6-features.md](../phase6-features.md) for feature flags.

---

## Active Subprocessors (Core Features)

### 1. Vercel (Hosting & Deployment)

- **Purpose**: Application hosting, serverless functions, CDN
- **Data Processed**: 
  - HTTP request logs (IP addresses, user agents, timestamps)
  - Application code and static assets
  - Environment variables (encrypted)
- **Data Location**: Global (USA, EU, Asia-Pacific)
- **DPA Status**: ✅ Standard DPA available
- **GDPR Compliance**: Yes
- **Data Retention**: 
  - Request logs: 24 hours (Vercel default)
  - Application data: Until deployment deleted
- **Opt-Out**: Not possible (required for service operation)
- **Privacy Policy**: https://vercel.com/legal/privacy-policy
- **Review Date**: 2024-Q4
- **Next Review**: 2025-Q2

---

### 2. Database Provider (Supabase or Self-Hosted PostgreSQL)

**Option A: Supabase (if using hosted database)**

- **Purpose**: PostgreSQL database hosting, real-time subscriptions
- **Data Processed**:
  - User accounts (email, hashed passwords)
  - Scan records and findings (redacted)
  - Session tokens
- **Data Location**: USA or EU (configurable)
- **DPA Status**: ✅ Standard DPA available
- **GDPR Compliance**: Yes
- **Data Retention**: User-controlled (until account deletion)
- **Encryption**: AES-256 at rest, TLS 1.2+ in transit
- **Opt-Out**: Not possible (required for service operation)
- **Privacy Policy**: https://supabase.com/privacy
- **Review Date**: [BEFORE AUTH LAUNCH]
- **Next Review**: Annually

**Option B: Self-Hosted PostgreSQL**

- **Purpose**: Database hosting
- **Data Processed**: Same as Supabase
- **Data Location**: Self-managed
- **DPA Status**: N/A (self-hosted)
- **Subprocessor**: None (direct control)

---

## Optional Subprocessors (Feature-Gated)

### 3. Anthropic (LLM Enrichment) — Optional

- **Enabled When**: `ANTHROPIC_API_KEY` is set
- **Purpose**: AI-powered finding explanations and fix prompts
- **Data Processed**:
  - Redacted security findings (secrets already masked)
  - Finding titles, categories, severity levels
  - Generic scan context (NO full website HTML or unredacted secrets)
- **Data NOT Processed**:
  - Full API keys or passwords
  - User email addresses or account info
  - Complete target URLs (only generic descriptions)
- **Data Location**: USA
- **DPA Status**: ⚠️ TO BE SIGNED BEFORE PRODUCTION
- **GDPR Compliance**: Yes (with DPA)
- **Data Retention**: 
  - Standard plan: 30 days for abuse detection
  - Zero-retention plan: Immediate deletion (recommended for production)
- **Training**: Data NOT used for model training without explicit opt-in
- **Opt-Out**: Yes — set `LLM_ENRICHMENT_ENABLED=false`
- **Privacy Policy**: https://www.anthropic.com/privacy
- **Commercial Terms**: https://www.anthropic.com/legal/commercial-terms
- **Review Date**: [BEFORE PHASE 5 PRODUCTION LAUNCH]
- **Next Review**: Quarterly
- **High-Risk Content Gating**: See section 4 below

---

### 4. Stripe (Payment Processing) — Optional

- **Enabled When**: `STRIPE_ENABLED=true`
- **Purpose**: Payment processing, subscription management
- **Data Processed**:
  - Email addresses
  - Payment methods (credit cards, ACH — Stripe-managed, NOT stored by us)
  - Billing addresses
  - Subscription tier and status
  - Invoice history
- **Data NOT Stored by VibeSafe**: 
  - Full credit card numbers (Stripe only)
  - CVV codes (never stored anywhere)
- **Data Location**: Global (Stripe operates worldwide)
- **DPA Status**: ✅ Standard DPA available
- **GDPR Compliance**: Yes
- **PCI-DSS Compliance**: Yes (Stripe is Level 1 PCI-DSS certified)
- **Data Retention**: 
  - Active subscriptions: Until canceled
  - Payment records: 7 years (tax/legal requirement)
- **Opt-Out**: Yes — disable `STRIPE_ENABLED` for free-only deployment
- **Privacy Policy**: https://stripe.com/privacy
- **Review Date**: 2024-Q4
- **Next Review**: Annually

---

### 5. Cloudflare R2 (PDF Storage) — Optional

- **Enabled When**: `PDF_EXPORT_ENABLED=true`
- **Purpose**: Object storage for generated PDF reports
- **Data Processed**:
  - PDF files containing scan reports
  - Metadata (scan ID, generated timestamp)
- **Data Location**: Global CDN (Cloudflare edge network)
- **DPA Status**: ✅ Standard DPA available
- **GDPR Compliance**: Yes
- **Data Retention**: User-controlled (until user deletes report)
- **Encryption**: AES-256 at rest
- **Access Control**: Signed URLs with expiration (15-minute default)
- **Opt-Out**: Yes — disable `PDF_EXPORT_ENABLED`
- **Privacy Policy**: https://cloudflare.com/privacypolicy
- **Review Date**: [BEFORE PDF EXPORT LAUNCH]
- **Next Review**: Annually

---

### 6. Supabase Auth (Authentication) — Optional

- **Enabled When**: `AUTH_ENABLED=true` and `AUTH_PROVIDER=supabase`
- **Purpose**: User authentication, session management
- **Data Processed**:
  - Email addresses
  - Hashed passwords (bcrypt)
  - Session tokens (JWTs)
  - OAuth tokens (if GitHub/Google login used)
- **Data Location**: USA or EU (configurable)
- **DPA Status**: ✅ Standard DPA available
- **GDPR Compliance**: Yes
- **Data Retention**: Until account deletion + 30 days
- **Opt-Out**: Yes — use `AUTH_PROVIDER=nextauth` or disable auth entirely
- **Privacy Policy**: https://supabase.com/privacy
- **Review Date**: [BEFORE AUTH LAUNCH]
- **Next Review**: Annually

---

### 7. NextAuth Providers (Google, GitHub) — Optional

- **Enabled When**: `AUTH_ENABLED=true` and `AUTH_PROVIDER=nextauth`
- **Purpose**: OAuth authentication
- **Data Processed**:
  - Email address (from OAuth provider)
  - Profile name and avatar (optional)
  - OAuth access tokens (encrypted, stored on our DB)
- **Data Location**: 
  - Google: Global
  - GitHub: USA
- **DPA Status**: 
  - Google: ✅ Standard DPA available
  - GitHub: ✅ Standard DPA available
- **GDPR Compliance**: Yes
- **Data Retention**: Until account deletion
- **Opt-Out**: Yes — use `AUTH_PROVIDER=supabase` or disable auth
- **Privacy Policies**: 
  - Google: https://policies.google.com/privacy
  - GitHub: https://docs.github.com/en/site-policy/privacy-policies
- **Review Date**: [BEFORE AUTH LAUNCH]
- **Next Review**: Annually

---

## 4. High-Risk Content Gating (Anthropic LLM)

### Prohibited Data in LLM Prompts

The following data types MUST NEVER be sent to Anthropic or any LLM provider:

❌ **Full secrets or API keys** (only send redacted versions: `sk_live_****e4Rk`)  
❌ **Session cookies or authentication tokens**  
❌ **Unredacted passwords or credentials**  
❌ **Complete credit card numbers** (we don't scan for these anyway)  
❌ **Social Security Numbers or other government IDs**  
❌ **Full target URLs** (only send generic descriptions like "an e-commerce site")  
❌ **User email addresses or account identifiers**  
❌ **Entire website HTML dumps** (only send specific finding context)

### Allowed Data in LLM Prompts

✅ **Redacted evidence**: `sk_live_51Hx****e4Rk`  
✅ **Finding titles**: "Stripe live secret key exposed in JavaScript bundle"  
✅ **Generic context**: "The website uses Next.js and has exposed secrets in client-side code"  
✅ **Severity levels**: CRITICAL, HIGH, MEDIUM, LOW  
✅ **Module IDs**: P1-01, P1-02, etc.  
✅ **Generic fix advice**: "Move secrets to environment variables"

### Implementation (Phase 5)

**File**: `src/lib/llm/enrichment.ts`

```typescript
function sanitizeForLLM(finding: RawFinding): SafeFinding {
  return {
    moduleId: finding.moduleId,
    severity: finding.severity,
    category: finding.category,
    title: finding.title,
    // Evidence is ALREADY redacted by scanner modules
    evidence: finding.evidence, 
    // Strip any remaining sensitive patterns as extra safety layer
    explanation: stripSensitivePatterns(finding.explanation),
  };
}
```

**Regression Tests**: Must verify no full secrets reach LLM API.

---

## 5. Subprocessor Change Notification

We will notify users of new subprocessors or material changes to existing ones:

- **Notification Method**: Email (for registered users) + 30-day advance notice on website
- **Notification Trigger**: Adding new subprocessor, changing DPA terms, moving data to new region
- **Opt-Out Window**: 30 days to object or cancel account before change takes effect

---

## 6. Subprocessor Approval Process

Before adding a new subprocessor:

1. ✅ Verify GDPR/CCPA compliance
2. ✅ Obtain and review DPA or Standard Contractual Clauses
3. ✅ Confirm data location and transfer mechanisms
4. ✅ Review privacy policy and data retention
5. ✅ Add to this register with review date
6. ✅ Notify users (if adding after launch)
7. ✅ Set up monitoring alerts for security advisories

---

## 7. Monitoring and Review Schedule

- **Quarterly**: Review Anthropic terms (high-risk LLM processing)
- **Annually**: Review all other subprocessors
- **Ad-hoc**: When security advisories published or DPA terms change
- **Post-breach**: Immediate review if subprocessor experiences data breach

**Next Full Review**: [TO BE DETERMINED AFTER LAUNCH]

---

## 8. Contact for Subprocessor Questions

**Email**: privacy@[DOMAIN].com  
**Subject Line**: "Subprocessor Inquiry"

---

**END OF SUBPROCESSOR REGISTER**
