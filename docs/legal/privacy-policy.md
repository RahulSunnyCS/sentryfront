# Privacy Policy

**Last Updated**: [TO BE DETERMINED BEFORE LAUNCH]  
**Effective Date**: [TO BE DETERMINED BEFORE LAUNCH]

---

## 1. Introduction

VibeSafe ("we", "us", "our") respects your privacy. This Privacy Policy explains how we collect, use, disclose, and protect your information when you use our security scanning service.

---

## 2. Information We Collect

### 2.1 Scan Inputs

- **Target URLs**: The website URLs you submit for scanning
- **Public Website Content**: HTML, JavaScript, CSS, HTTP headers, cookies, and other publicly accessible data from the scanned website
- **Network Metadata**: DNS records, TLS/SSL certificates, subdomain information

### 2.2 Account Information (when auth enabled)

- **Email Address**: For account creation and notifications
- **Password Hash**: Securely hashed, never stored in plaintext
- **Subscription Tier**: Free, One-Shot, Pro, or Studio
- **Stripe Customer ID**: When payment processing is enabled

### 2.3 Technical Information

- **IP Address**: For rate limiting and abuse prevention
- **User Agent**: Browser and operating system information
- **Timestamps**: When scans were initiated and completed
- **Device Information**: Screen resolution, browser type (standard web analytics)

### 2.4 Scan Results

- **Security Findings**: Vulnerabilities and misconfigurations detected
- **Redacted Evidence**: Secrets, tokens, and sensitive data with middle characters masked
- **Scan Metadata**: Grade, score, severity counts, scan duration

### 2.5 What We DO NOT Collect

- **Full Secrets or Passwords**: Only redacted versions (first 4 + last 4 characters)
- **Private Website Content**: We only scan publicly accessible pages
- **Unrelated Browsing History**: We do not track your activity outside of VibeSafe
- **Social Security Numbers, Credit Cards, or Other PII** (unless exposed on the scanned website and immediately redacted)

---

## 3. How We Use Your Information

We use collected information to:

- **Perform Security Scans**: Crawl websites, analyze content, generate findings
- **Generate Reports**: Create security reports with grades, findings, and fix prompts
- **Improve the Service**: Analyze scan patterns to enhance detection modules
- **Prevent Abuse**: Rate-limit excessive scanning, block malicious use
- **Process Payments**: Handle subscriptions and billing (when Stripe is enabled)
- **Send Notifications**: Email scan completion alerts (when auth is enabled)
- **Comply with Legal Obligations**: Respond to subpoenas, DMCA requests, or law enforcement inquiries

---

## 4. LLM Processing (Optional Feature)

### 4.1 When LLM Enrichment is Enabled

If you have configured `ANTHROPIC_API_KEY`, scan findings are sent to Anthropic's API for AI-powered explanations and fix prompts.

**Data sent to Anthropic**:
- Finding titles and categories
- Redacted evidence (secrets already masked)
- Module IDs and severity levels
- Generic scan context (NOT including full website HTML or unredacted secrets)

**Data NOT sent to Anthropic**:
- Full secrets, session cookies, or authentication tokens
- Complete website HTML dumps
- User email addresses or account information
- Target URLs (only generic finding descriptions)

### 4.2 Anthropic's Data Handling

Per Anthropic's terms (as of 2025):
- API inputs may be retained for up to 30 days for abuse detection
- Data is NOT used for model training without explicit opt-in
- Enterprise plans offer zero data retention options

We recommend using Anthropic's zero-retention plan before commercial launch.

---

## 5. Data Sharing and Third Parties

### 5.1 Subprocessors (when features are enabled)

| Service | Purpose | Data Shared | Region | Privacy Policy |
|---------|---------|-------------|--------|----------------|
| Anthropic | AI enrichment | Redacted findings | USA | https://www.anthropic.com/privacy |
| Stripe | Payment processing | Email, payment info | Global | https://stripe.com/privacy |
| Cloudflare R2 | PDF storage | PDF reports | Global | https://cloudflare.com/privacypolicy |
| Supabase | Authentication | Email, password hash | USA/EU | https://supabase.com/privacy |
| Vercel | Hosting | Request logs | Global | https://vercel.com/legal/privacy-policy |

### 5.2 Legal Disclosures

We may disclose information to:
- Comply with legal process (subpoenas, court orders)
- Enforce our Terms of Service
- Protect against fraud or abuse
- Respond to DMCA takedown notices

### 5.3 No Data Sales

We do NOT sell your personal information to third parties for marketing purposes.

---

## 6. Data Retention

| Data Type | Retention Period | Deletion Policy |
|-----------|------------------|-----------------|
| Scan reports | Until user deletion or account closure | User-controlled |
| Raw crawl artifacts | 24 hours | Auto-deleted |
| Request logs | 90 days | Auto-deleted |
| Redacted evidence | Same as scan reports | User-controlled |
| Account data | Until account closure + 30 days | Auto-deleted |
| Backups | 30 days | Rolling backups |
| Payment records | 7 years (tax/legal requirement) | Archived, not deleted |

---

## 7. Data Security

We implement industry-standard security measures:

- **Encryption in Transit**: TLS 1.2+ for all connections
- **Encryption at Rest**: Database and PDF storage encrypted
- **Secret Redaction**: Automated before storage or LLM processing
- **Access Controls**: Role-based access, admin audit logs
- **Regular Updates**: Security patches applied within 14 days

**No system is 100% secure.** We cannot guarantee absolute protection against unauthorized access or breaches.

---

## 8. Your Rights (GDPR/CCPA)

### 8.1 Right to Access

Request a copy of all data we have about you.

### 8.2 Right to Deletion

Request deletion of your account and all associated scan data.

### 8.3 Right to Correction

Update incorrect account information.

### 8.4 Right to Data Portability

Export your scan reports in JSON or PDF format.

### 8.5 Right to Opt-Out (CCPA)

California residents may opt-out of data sales (we don't sell data, but you can request confirmation).

### 8.6 How to Exercise Rights

Email: privacy@[DOMAIN].com  
Response time: 30 days

---

## 9. Cookies and Tracking

We use:
- **Session cookies**: For authentication (when auth is enabled)
- **Analytics cookies**: To measure usage (optional, can be disabled)

We do NOT use:
- Third-party advertising cookies
- Cross-site tracking
- Behavioral retargeting

---

## 10. Children's Privacy

VibeSafe is not intended for users under 18. We do not knowingly collect data from children.

---

## 11. International Data Transfers

Data may be processed in the USA and EU. By using the Service, you consent to international data transfers as necessary to provide the Service.

---

## 12. Changes to This Policy

We will notify users of material changes via:
- Email (for registered users)
- Banner notice on the website
- 30 days advance notice before changes take effect

---

## 13. Contact Us

**Privacy Inquiries**: privacy@[DOMAIN].com  
**Data Deletion Requests**: privacy@[DOMAIN].com  
**Security Concerns**: security@[DOMAIN].com

**Mailing Address**:  
[TO BE DETERMINED BEFORE LAUNCH]

---

**END OF PRIVACY POLICY**
