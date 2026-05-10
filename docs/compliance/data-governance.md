# Data Governance and Classification

**Version**: 1.0  
**Last Updated**: [TO BE DETERMINED]  
**Owner**: Engineering / Compliance

---

## 1. Data Classification

All data handled by VibeSafe is classified into the following categories:

### 1.1 Public Data

**Definition**: Information that can be freely shared without security or privacy concerns.

**Examples**:
- Marketing materials
- Public documentation
- Open-source code (when applicable)
- Publicly accessible website content (before redaction)

**Retention**: Indefinite  
**Encryption**: Not required (but implemented anyway)  
**Access**: Public

---

### 1.2 Internal Data

**Definition**: Business data not intended for public disclosure but not highly sensitive.

**Examples**:
- Internal documentation and specs
- Product roadmaps
- Development logs (non-security)
- Aggregate scan statistics (anonymized)

**Retention**: Varies by type, typically 1–3 years  
**Encryption**: In transit (TLS)  
**Access**: VibeSafe employees only

---

### 1.3 Confidential Data

**Definition**: Data that could cause harm if disclosed inappropriately.

**Examples**:
- User account information (emails, hashed passwords)
- Scan target URLs (may reveal customer identities)
- Redacted security findings
- Payment metadata (Stripe customer IDs, subscription tiers)
- IP addresses and request logs

**Retention**: See section 3 (Retention Windows)  
**Encryption**: In transit (TLS 1.2+) and at rest (AES-256)  
**Access**: Authorized employees, logged access

---

### 1.4 Highly Sensitive Data (Redacted on Ingestion)

**Definition**: Data that MUST be redacted before storage to protect users.

**Examples**:
- Full API keys and secrets (redacted to `****`)
- Session cookies and auth tokens (redacted)
- JWT payloads containing sensitive claims (redacted)
- Full passwords or credentials (never stored, even redacted)
- Complete credit card numbers (never scanned or stored)

**Retention**: NEVER STORED IN FULL  
**Redaction**: Automatic, before DB write  
**Encryption**: N/A (redacted before storage)  
**Access**: No one (full values never persist)

**Redaction Format**: `[first 4 chars]****[last 4 chars]`

---

## 2. Data Storage Locations

| Data Type | Storage System | Region | Encryption at Rest | Backup |
|-----------|----------------|--------|-------------------|--------|
| User accounts | PostgreSQL (Supabase/self-hosted) | USA/EU | AES-256 | 30-day rolling |
| Scan records | PostgreSQL | USA/EU | AES-256 | 30-day rolling |
| Findings (redacted) | PostgreSQL | USA/EU | AES-256 | 30-day rolling |
| PDF reports | Cloudflare R2 | Global CDN | AES-256 | User-controlled |
| Request logs | Axiom / self-hosted | USA | AES-256 | 90 days, then deleted |
| Raw crawl artifacts | Ephemeral (in-memory) | N/A | Not persisted | None (deleted after scan) |
| LLM prompts/responses | Anthropic API | USA | Anthropic-managed | 30 days (Anthropic policy) |

---

## 3. Data Retention Windows

| Data Category | Retention Period | Deletion Policy | Justification |
|---------------|------------------|-----------------|---------------|
| **Scan reports** | Until user deletion or account closure | User-initiated or auto-deleted 30 days after account closure | User owns their reports |
| **Raw crawl artifacts** | 24 hours maximum | Auto-deleted after scan completes | No business need to retain |
| **Redacted findings** | Same as scan reports | Deleted with parent scan | Part of scan report |
| **Request logs** | 90 days | Auto-deleted | Compliance, debugging, abuse detection |
| **Account data** | Until account closure + 30 days | Auto-deleted 30 days after closure | Legal hold period |
| **Payment records** | 7 years | Archived, not deleted | Tax/legal requirement (IRS, Stripe) |
| **Backups** | 30 days | Rolling backups, oldest deleted | Disaster recovery |
| **LLM API logs** | 30 days (Anthropic) | Managed by Anthropic | Third-party retention policy |

---

## 4. Secret Redaction Verification

### 4.1 Redaction Points

Secrets MUST be redacted at these points:

1. **Before database write** (`src/lib/scanner/modules/p1-01-secrets.ts`)
2. **Before LLM API call** (`src/lib/llm/enrichment.ts`)
3. **Before log output** (all logger instances)
4. **Before PDF generation** (Phase 6, when implemented)

### 4.2 Redaction Function

```typescript
// src/lib/scanner/modules/p1-01-secrets.ts
function redactSecret(secret: string): string {
  if (secret.length <= 8) return '****'; // Too short to show first/last
  const first4 = secret.slice(0, 4);
  const last4 = secret.slice(-4);
  return `${first4}****${last4}`;
}
```

### 4.3 Regression Tests

**Test file**: `src/lib/scanner/modules/p1-01-secrets.test.ts` (to be created in Phase 7)

**Test cases**:
- Stripe secret keys redacted before storage
- API keys redacted in finding.evidence field
- JWT tokens redacted in cookies module
- Session cookies redacted in headers
- No full secrets in LLM prompts
- No full secrets in PDF exports

**CI Gate**: These tests MUST pass before merging code.

---

## 5. Encryption Standards

### 5.1 Encryption in Transit

- **TLS 1.2 or higher** for all HTTPS connections
- **TLS 1.3 preferred** where supported
- **HSTS enabled** with max-age=31536000
- **Certificate renewal** automated via Let's Encrypt or cloud provider

### 5.2 Encryption at Rest

- **Database**: AES-256 encryption (managed by Supabase/cloud provider)
- **File storage (R2)**: AES-256 encryption (Cloudflare-managed)
- **Backups**: Encrypted with same standard as production DB

### 5.3 Key Management

- **Production secrets**: Stored in environment variables or Vercel/Railway secrets manager
- **Database encryption keys**: Managed by cloud provider (Supabase, AWS RDS, etc.)
- **API keys (Stripe, Anthropic)**: Never committed to git, only in .env (gitignored)
- **Rotation**: Rotate Stripe/Anthropic keys every 12 months or on suspected compromise

---

## 6. Access Controls

### 6.1 Database Access

- **Production database**: Only authorized engineers with 2FA
- **Read-only replicas**: Analytics team (when needed)
- **Admin accounts**: Require 2FA + VPN
- **Audit logging**: All production DB queries logged

### 6.2 Application Access

- **User tier gating**: Free users see top 5 findings, paid users see all (when TIER_GATING_ENABLED=true)
- **Report access**: Only scan creator can view report (when AUTH_ENABLED=true)
- **Anonymous scans**: Public URL, but not indexed or discoverable (when AUTH_ENABLED=false)

### 6.3 Employee Access

- **Customer data access**: Prohibited except for support tickets (with user consent)
- **Scan reports**: Never accessed unless user requests support
- **Payment data**: Only Stripe dashboard (never raw card numbers)

---

## 7. Data Export and Portability

### 7.1 User-Initiated Export

When auth is enabled, users can export:
- All scan reports (JSON format)
- PDF versions (if PDF export is enabled)
- Account metadata (email, tier, created date)

**Export format**: JSON or PDF  
**Delivery method**: Download link or email  
**Response time**: Immediate (for JSON), <24 hours (for batch PDF)

### 7.2 GDPR/CCPA Data Requests

**Request types**:
- Access: Provide all stored data
- Deletion: Permanently delete account and scans
- Correction: Update email or account details
- Portability: Export in machine-readable format

**Process**: Email privacy@[DOMAIN].com  
**Response time**: 30 days maximum

---

## 8. Breach Notification

### 8.1 Detection

- **Automated alerts**: Unusual database access, bulk exports, failed login attempts
- **Security monitoring**: Sentry error tracking, Axiom log analysis
- **Third-party notifications**: Monitor Stripe, Anthropic, Cloudflare security advisories

### 8.2 Response Plan

1. **Contain** (within 1 hour): Disable affected systems, revoke compromised keys
2. **Investigate** (within 24 hours): Determine scope, affected users, root cause
3. **Notify** (within 72 hours): Email affected users, file GDPR breach report if EU data involved
4. **Remediate** (within 7 days): Patch vulnerability, rotate keys, restore from backups if needed
5. **Post-mortem** (within 14 days): Document incident, update security measures

### 8.3 Notification Thresholds

Notify users if:
- Full (unredacted) secrets were exposed
- Account passwords or session tokens were compromised
- Payment information was accessed (Stripe webhook compromise)
- More than 100 user accounts affected

Do NOT notify for:
- Redacted findings exposure (no new risk)
- Public URL scans (already public)
- Logs containing only IP addresses (low risk)

---

## 9. Vendor Data Processing Agreements (DPAs)

| Vendor | DPA Status | GDPR-Compliant | Data Location | Review Date |
|--------|------------|----------------|---------------|-------------|
| Anthropic | [TO BE SIGNED] | Yes | USA | Before Phase 5 launch |
| Stripe | Standard DPA | Yes | Global | Reviewed 2024-Q4 |
| Cloudflare | Standard DPA | Yes | Global | Reviewed 2024-Q4 |
| Supabase | Standard DPA | Yes | USA/EU | Before auth launch |
| Vercel | Standard DPA | Yes | Global | Reviewed 2024-Q4 |

---

## 10. Compliance Checklist

✅ **Before Beta Launch**:
- [ ] All secrets redacted in DB (verified via tests)
- [ ] Encryption at rest enabled (PostgreSQL, R2)
- [ ] TLS 1.2+ enforced (HSTS enabled)
- [ ] Retention windows documented and enforced
- [ ] DPAs signed with all subprocessors
- [ ] Privacy Policy published
- [ ] Data export functionality tested
- [ ] Breach notification plan documented

✅ **Before Paid Launch**:
- [ ] Stripe DPA signed
- [ ] Payment data never stored on our servers (confirmed)
- [ ] LLM redaction verified (no full secrets to Anthropic)
- [ ] White-label PDF export tested (if enabled)
- [ ] Audit logging enabled for admin actions

---

**END OF DATA GOVERNANCE DOCUMENTATION**
