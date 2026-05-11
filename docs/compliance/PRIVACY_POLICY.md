# Privacy Policy

**Effective Date:** 2026-05-11  
**Last Updated:** 2026-05-11

[Your Company Name] ("we", "us", "our") operates VibeSafe, a web security and quality scanning platform. This Privacy Policy explains how we collect, use, store, and protect your personal information.

By using VibeSafe, you consent to the practices described in this Policy.

---

## 1. Information We Collect

### 1.1 Account Information
When you create an account, we collect:
- **Email address** (for authentication, notifications)
- **Name** (optional, for personalization)
- **OAuth provider data** (GitHub, Google: name, email, profile photo)
- **Password hash** (if using email/password authentication)

### 1.2 Payment Information
When you subscribe to a paid plan:
- **Payment method** (credit card, PayPal) — processed and stored by Stripe, Inc.
- **Billing address** (for tax/VAT calculation)
- **Purchase history** (subscriptions, invoices, refunds)

**We do NOT store full credit card numbers.** Payment data is handled by Stripe under PCI-DSS compliance.

### 1.3 Scan Data
When you run a scan, we collect:
- **Target URL** (the website you're scanning)
- **Scan results** (findings, security issues, performance metrics, accessibility violations)
- **Redacted evidence** (secrets, cookies, headers redacted to first/last 4 characters)
- **Crawl artifacts** (HTML snapshots, screenshots, network logs — temporary)
- **Scan metadata** (timestamp, duration, status, IP address of scanner)

### 1.4 Usage Data
We automatically collect:
- **Log data** (IP address, browser type, device, operating system)
- **Session data** (authentication tokens, session duration)
- **Feature usage** (which modules you enable, pages visited, buttons clicked)
- **Error data** (crashes, exceptions, stack traces via Sentry)

### 1.5 Cookies and Tracking
- **Session cookies** (for authentication, required to use the Service)
- **Analytics cookies** (optional, Google Analytics or similar)
- **Preference cookies** (theme, language, settings)

You can disable optional cookies in your browser. Session cookies are required for functionality.

---

## 2. How We Use Your Information

### 2.1 To Provide the Service
- Process scans and generate reports
- Store your scan history and findings
- Send scan completion notifications
- Provide customer support

### 2.2 To Improve the Service
- Analyze usage patterns (anonymized/aggregated)
- Fix bugs and improve performance
- Develop new features
- Train machine learning models (anonymized findings only, never raw secrets)

### 2.3 To Communicate with You
- Transactional emails (scan results, account changes, billing)
- Marketing emails (product updates, new features) — **opt-out available**
- Security notifications (breach alerts, suspicious activity)

### 2.4 To Comply with Legal Obligations
- Respond to legal requests (subpoenas, court orders)
- Investigate fraud, abuse, or terms violations
- Comply with tax, export, and sanctions laws

### 2.5 AI/LLM Processing
If LLM enrichment is enabled:
- **Redacted findings** are sent to Anthropic Claude API for explanation generation
- **No full secrets, credentials, or PII** are included in LLM prompts
- Anthropic's data retention policy applies (see Section 6.3)

---

## 3. Data Retention

### 3.1 Account Data
- Retained while your account is active
- Deleted within **30 days** of account deletion (unless required by law)

### 3.2 Scan Results
- **Stored indefinitely** while your account is active (for historical comparison)
- You may delete individual scan reports at any time
- Deleted within **30 days** of account deletion

### 3.3 Crawl Artifacts (Temporary)
- **HTML snapshots, screenshots, network logs:** Deleted within **7 days** of scan completion
- Used only for scan processing, not stored long-term

### 3.4 Payment Data
- **Stripe retains payment data** per their retention policy
- We store transaction history (invoices, amounts) indefinitely for tax/accounting compliance

### 3.5 Logs and Analytics
- **Server logs:** Retained for **90 days**
- **Error logs (Sentry):** Retained for **30 days**
- **Anonymized analytics:** Retained indefinitely (no personal identifiers)

---

## 4. Data Security

### 4.1 Encryption
- **In transit:** TLS 1.2+ for all data transmission
- **At rest:** AES-256 encryption for database and file storage (Cloudflare R2, PostgreSQL)
- **Passwords:** Hashed with bcrypt (never stored in plaintext)

### 4.2 Access Controls
- **Role-based access:** Employees have least-privilege access
- **MFA required:** For all administrative accounts
- **Audit logs:** All sensitive data access logged

### 4.3 Redaction
- **Secrets, tokens, API keys:** Redacted to first 4 and last 4 characters before storage
- **Cookies, session IDs:** Redacted before storage, logs, and LLM prompts
- **PII in evidence:** Minimized and redacted where detected

### 4.4 Infrastructure Security
- **Hosting:** Vercel (SOC 2 Type II)
- **Database:** Vercel Postgres / Neon (encrypted at rest)
- **Storage:** Cloudflare R2 (private buckets, signed URLs)
- **Monitoring:** Sentry (error tracking, GDPR-compliant)

---

## 5. Data Sharing and Subprocessors

We share data with the following third-party service providers ("subprocessors"):

| Subprocessor | Purpose | Data Shared | Location | DPA Available |
|--------------|---------|-------------|----------|---------------|
| **Vercel** | Hosting, serverless functions | Account data, scan data, logs | US, EU | ✅ Yes |
| **Neon / Vercel Postgres** | Database hosting | All database records | US, EU | ✅ Yes |
| **Stripe** | Payment processing | Payment method, billing address | US, EU | ✅ Yes |
| **Anthropic** | LLM enrichment (optional) | Redacted findings (no secrets) | US | ✅ Enterprise only |
| **Sentry** | Error tracking | Error logs, stack traces, user IDs | US, EU | ✅ Yes |
| **Cloudflare R2** | PDF storage, screenshots | Scan artifacts, PDFs | Global (configurable) | ✅ Yes |
| **Redis Labs / Upstash** | Caching, job queue | Session data, scan queue | US, EU | ✅ Yes |

**DPA (Data Processing Agreement):** Available for Enterprise tier customers upon request.

---

## 6. Your Rights (GDPR, CCPA, and Privacy Laws)

### 6.1 Access and Portability
- **Right to access:** Request a copy of your data (JSON export available in account settings)
- **Right to portability:** Export scan history and findings at any time

### 6.2 Correction and Deletion
- **Right to correction:** Update account information in settings
- **Right to erasure ("right to be forgotten"):** Delete your account and all associated data

### 6.3 Objection and Restriction
- **Right to object:** Opt out of marketing emails (link in every email)
- **Right to restrict processing:** Contact us to limit how we use your data

### 6.4 Withdraw Consent
- **LLM enrichment:** Disable in settings to stop sending data to Anthropic
- **Analytics cookies:** Disable in browser or via cookie banner

### 6.5 Data Protection Officer
For GDPR or privacy inquiries: **privacy@vibesafe.example**

### 6.6 Supervisory Authority
EU users have the right to lodge a complaint with your local data protection authority.

---

## 7. International Data Transfers

### 7.1 Data Storage Locations
- **Primary:** United States (Vercel, Neon, Stripe, Anthropic)
- **EU option:** Available for Enterprise customers (Vercel EU regions, Neon EU)

### 7.2 Transfer Mechanisms
- **EU-US Data Privacy Framework:** Vercel, Stripe, Sentry are certified
- **Standard Contractual Clauses (SCCs):** Available for Enterprise tier
- **Adequacy decisions:** UK, Switzerland, EEA adequacy recognized

### 7.3 Anthropic Data Processing
- **Default:** Data sent to Anthropic API (US-based)
- **Retention:** Zero-retention available for Enterprise tier (contact Anthropic)
- **Training:** Anthropic does not train on API data unless explicitly opted in

---

## 8. Children's Privacy

VibeSafe is not intended for users under 18 (or age of majority in your jurisdiction).

We do not knowingly collect data from children. If you believe we have collected data from a minor, contact us immediately at **privacy@vibesafe.example** for deletion.

---

## 9. California Privacy Rights (CCPA)

California residents have additional rights under the California Consumer Privacy Act (CCPA):

### 9.1 Categories of Information Collected
- **Identifiers:** Email, name, IP address
- **Commercial information:** Purchase history, subscription tier
- **Internet activity:** Browsing behavior, scan history
- **Geolocation:** Approximate location (city/country from IP)

### 9.2 Business Purpose
We collect and use your information to provide the Service, as described in Section 2.

### 9.3 Sale of Personal Information
**We do NOT sell your personal information** to third parties.

### 9.4 CCPA Rights
- **Right to know:** Request disclosure of data collected about you
- **Right to delete:** Request deletion of your data
- **Right to opt-out:** We don't sell data, so no opt-out needed
- **Right to non-discrimination:** We will not discriminate for exercising your rights

**To exercise rights:** Email **privacy@vibesafe.example** with "CCPA Request" in subject line.

---

## 10. Changes to This Policy

We may update this Privacy Policy from time to time.

- **Notice:** We will notify you via email or in-app notification 30 days before changes take effect
- **Acceptance:** Continued use after changes constitutes acceptance
- **Material changes:** Require explicit consent (e.g., new data processing purposes)

**Version history:** Available at [vibesafe.example/privacy/history](https://vibesafe.example/privacy/history)

---

## 11. Contact Us

**Privacy Inquiries:** privacy@vibesafe.example
**Data Protection Officer (DPO):** dpo@vibesafe.example
**Security Issues:** security@vibesafe.example
**General Support:** support@vibesafe.example

**Mailing Address:**
[Your Company Name]
[Street Address]
[City, State, ZIP]
[Country]

---

**Last reviewed:** 2026-05-11
**Effective:** 2026-05-11

**By using VibeSafe, you acknowledge that you have read and understood this Privacy Policy.**
