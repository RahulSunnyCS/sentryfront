# Terms of Service

**Last Updated**: [TO BE DETERMINED BEFORE LAUNCH]  
**Effective Date**: [TO BE DETERMINED BEFORE LAUNCH]

---

## 1. Acceptance of Terms

By accessing or using VibeSafe ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service.

---

## 2. Description of Service

VibeSafe is an automated security scanning tool that analyzes publicly accessible websites for security vulnerabilities and misconfigurations. The Service provides:

- Passive security scans of publicly accessible URLs
- Security reports with findings categorized by severity
- AI-generated fix prompts for identified issues
- Optional PDF export (when enabled)
- Optional active scanning (when domain verification is completed and feature is enabled)

---

## 3. Authorized Use and Scanning Restrictions

### 3.1 Authorization Requirement

You may only scan:
- Websites you own or operate
- Websites for which you have explicit written permission from the owner to perform security testing
- Websites where you are an authorized security researcher under a responsible disclosure or bug bounty program

### 3.2 Prohibited Targets

You may NOT scan:
- Government websites (federal, state, or local) without explicit authorization
- Financial institutions or payment processors without written permission
- Healthcare systems or HIPAA-covered entities without authorization
- Critical infrastructure (power, water, telecommunications, etc.)
- Any website where scanning would violate applicable law
- Any website explicitly prohibiting automated scanning in its robots.txt or terms of service

### 3.3 Passive vs Active Scans

- **Passive scans** (default): Analyze publicly accessible content similar to a normal browser visit
- **Active scans** (requires domain verification): May send additional probes and test requests
- Active scans are only available after domain ownership verification via DNS TXT record

### 3.4 Rate Limiting and Abuse

- Scans are rate-limited per IP address and per user account
- Attempting to circumvent rate limits or perform distributed scanning is prohibited
- Excessive scanning or patterns indicating automated abuse will result in account termination

---

## 4. User Accounts and Tiers

### 4.1 Account Registration

When authentication is enabled, you may create an account to access additional features. You are responsible for:
- Maintaining the confidentiality of your account credentials
- All activity that occurs under your account
- Notifying us immediately of any unauthorized use

### 4.2 Subscription Tiers

When payments are enabled, VibeSafe offers multiple subscription tiers:
- **Free**: Limited scans per month, basic reporting
- **One-Shot**: Single-use purchase for immediate scan
- **Pro**: Monthly subscription with enhanced features
- **Studio**: Agency/commercial tier with white-label reports

Pricing and tier limits are subject to change with 30 days notice.

### 4.3 Billing and Refunds

- Subscriptions are billed monthly or annually as selected
- Refunds are available within 14 days of initial purchase for paid tiers
- No refunds for One-Shot purchases after scan completion
- You may cancel your subscription at any time; access continues until end of billing period

---

## 5. Scope and Limitations of Service

### 5.1 Not a Security Audit or Certification

VibeSafe is an automated scanning tool, NOT:
- A comprehensive security audit or penetration test
- A compliance certification (PCI-DSS, SOC 2, ISO 27001, etc.)
- A guarantee of security or absence of vulnerabilities
- Legal advice or regulatory guidance

### 5.2 False Positives and False Negatives

- Automated scans may produce false positives (flagging secure configurations as issues)
- Automated scans may produce false negatives (missing actual vulnerabilities)
- Findings should be manually reviewed by qualified security professionals
- We make no warranty regarding the accuracy or completeness of scan results

### 5.3 Evidence Redaction

- Sensitive data (secrets, tokens, cookies) is redacted before storage
- Redacted evidence is shown as `****` with first/last 4 characters
- Full unredacted data is NEVER stored in our database or logs
- Redaction is best-effort; you are responsible for reviewing reports before sharing

---

## 6. Data and Privacy

### 6.1 Data Collection

We collect:
- Scan target URLs and public website content
- Security findings and redacted evidence
- Account information (email, tier, payment metadata) when auth is enabled
- Request metadata (IP address, timestamps, user agent)

We do NOT collect:
- Full secrets, passwords, or authentication tokens
- Personal data from scanned websites beyond what's publicly accessible
- Browsing history unrelated to scan requests

### 6.2 Data Retention

- Scan reports: Retained until user deletion or account closure
- Logs and analytics: Retained for 90 days
- Raw crawl artifacts: Deleted within 24 hours of scan completion
- Backups: Retained for 30 days

### 6.3 Third-Party Services

When features are enabled, data may be processed by:
- **LLM Provider (Anthropic)**: Redacted findings sent for AI enrichment
- **Stripe**: Payment processing (when payments enabled)
- **Cloudflare R2**: PDF storage (when PDF export enabled)
- **Auth Provider (Supabase/NextAuth)**: Authentication (when auth enabled)

See our Privacy Policy for complete details.

---

## 7. Intellectual Property

### 7.1 Service Ownership

VibeSafe, including all code, UI, scanner logic, and documentation, is proprietary or open-source (depending on deployment). You do not acquire any ownership rights by using the Service.

### 7.2 Scan Reports

You retain ownership of scan reports generated for your websites. You may download, share, and use reports as needed for security remediation.

### 7.3 Prohibited Use of Reports

You may NOT:
- Use reports to exploit or attack third-party websites
- Share reports publicly to harm a website's reputation without responsible disclosure
- Resell VibeSafe reports as a competing security scanning service

---

## 8. Disclaimer of Warranties

THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING:
- MERCHANTABILITY
- FITNESS FOR A PARTICULAR PURPOSE
- NON-INFRINGEMENT
- ACCURACY OR RELIABILITY OF SCAN RESULTS

---

## 9. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR:
- Any damages arising from use of the Service
- Security incidents resulting from vulnerabilities we failed to detect
- Legal consequences of scanning unauthorized targets
- Data loss, service interruptions, or errors in scan results

Maximum liability is limited to the amount paid in the last 12 months (or $100, whichever is less).

---

## 10. Termination

We may suspend or terminate your account if you:
- Violate these Terms
- Scan unauthorized targets
- Engage in abusive or illegal behavior
- Fail to pay subscription fees

You may terminate your account at any time by contacting support or deleting your account.

---

## 11. Changes to Terms

We may update these Terms with 30 days notice. Continued use after changes take effect constitutes acceptance.

---

## 12. Governing Law and Disputes

These Terms are governed by the laws of [JURISDICTION TO BE DETERMINED]. Disputes will be resolved through binding arbitration in [LOCATION TO BE DETERMINED].

---

## 13. Contact and Abuse Reporting

**Abuse Contact**: abuse@[DOMAIN].com  
**Support**: support@[DOMAIN].com  
**Legal/DMCA**: legal@[DOMAIN].com

For security vulnerabilities in VibeSafe itself, see our responsible disclosure policy at [URL TO BE DETERMINED].

---

**END OF TERMS OF SERVICE**
