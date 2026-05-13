# Future Features Roadmap

**VibeSafe - Planned Features & Expansion**  
**Last Updated:** 2026-05-13  
**Horizon:** Q2 2026 - Q4 2026

---

## Overview

This document outlines planned features beyond the current MVP, organized by priority and timeline.

---

## Q2 2026 (Apr - Jun)

### 1. GitHub Action (CI/CD Integration)

**Problem:** Developers want automated scans on every PR

**Solution:** GitHub Action that:
- Runs scan on PR creation
- Comments with results
- Blocks merge if grade < threshold

**Implementation:**
```yaml
# .github/workflows/vibesafe.yml

name: VibeSafe Security Scan

on:
  pull_request:
    branches: [main]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy PR Preview
        # ... deploy to preview URL
      
      - name: Run VibeSafe Scan
        uses: vibesafe/action@v1
        with:
          url: ${{ env.PREVIEW_URL }}
          api_key: ${{ secrets.VIBESAFE_API_KEY }}
          min_grade: 'B'
          fail_on_critical: true
      
      - name: Comment PR
        uses: vibesafe/comment-action@v1
        with:
          scan_id: ${{ steps.scan.outputs.scan_id }}
```

**Pricing:**
- Free for open-source
- Included in Pro tier
- $99/month for 1000 scans (enterprises)

---

### 2. API v2 (Programmatic Access)

**Features:**
- GraphQL support (more flexible queries)
- Webhooks (notify on scan completion)
- Bulk scanning (scan 10+ URLs at once)
- Scan scheduling (daily/weekly auto-scans)

**Example:**
```graphql
mutation CreateScan {
  createScan(input: {
    url: "https://example.com"
    modules: [SECURITY, PERFORMANCE]
    enableAI: true
  }) {
    id
    status
    estimatedCompletionTime
  }
}

subscription ScanProgress($id: ID!) {
  scanProgress(id: $id) {
    status
    progress
    grade
    findings {
      severity
      title
    }
  }
}
```

**Webhooks:**
```json
POST https://yourapp.com/webhooks/vibesafe
{
  "event": "scan.completed",
  "scan_id": "scan_abc123",
  "url": "https://example.com",
  "grade": "B",
  "timestamp": "2026-04-15T10:00:00Z"
}
```

---

### 3. Team Collaboration

**Features:**
- Team workspaces (share scans)
- Role-based access (admin, member, viewer)
- Comments on findings
- Assignment (assign fixes to team members)
- Slack/Discord notifications

**Use Case:**
- Agency scans client sites
- Assigns findings to developers
- Client gets view-only access to reports

---

## Q3 2026 (Jul - Sep)

### 4. Mobile App (React Native)

**Platforms:** iOS & Android

**Features:**
- Quick URL scans
- View scan history
- Push notifications (scan complete)
- Share reports via PDF
- QR code scanner (scan printed URLs)

**Monetization:**
- Same pricing tiers as web
- In-app purchases for one-time scans ($2.99)

---

### 5. Advanced Reporting

**Features:**
- Historical trending (track grade over time)
- Comparison reports (scan A vs scan B)
- Executive summaries (for non-technical stakeholders)
- Custom report templates
- White-label reports (agencies can brand)

**Example Trending Chart:**
```
Grade History (Last 30 Days)

A  ┤     ●
B  ┤  ●─●─  ─●
C  ┤●─        
D  ┤           
   └───────────────────
   1d  7d  14d  30d
```

---

### 6. Custom Scan Configurations

**Features:**
- Enable/disable specific modules
- Custom severity levels
- Whitelist false positives
- Custom regex patterns (for secrets)

**Use Case:**
- E-commerce site only cares about security + performance
- Disable accessibility checks to reduce noise

**UI:**
```
[ ] Security (15 modules)
  [x] P1-01: Client-side secrets
  [x] P1-02: Source maps
  [ ] P1-03: Security headers (whitelisted)
  ...
  
[ ] Performance (6 modules)
[ ] Accessibility (5 modules)
[ ] SEO (5 modules)
```

---

## Q4 2026 (Oct - Dec)

### 7. Enterprise Features

**Single Sign-On (SSO)**
- SAML 2.0 support
- Okta, Auth0, Azure AD integration
- Auto-provision teams

**Advanced Security:**
- IP whitelisting
- Audit logs
- Data residency options (EU/US/Asia)
- SOC 2 Type II compliance

**Pricing:**
- $499/month (10K scans)
- Custom pricing for >100K scans/month

---

### 8. Multi-Product Strategy (SaaS Factory)

**Concept:** Use VibeSafe infrastructure to build related products

**Planned Products:**

**1. SpeedCheck**
- Performance-only scanner (simpler, cheaper)
- Target: Developer tools category
- Pricing: $9/month

**2. A11yAudit**
- Accessibility-only scanner
- WCAG compliance reports
- Target: Government, education, healthcare
- Pricing: $29/month (compliance premium)

**3. SEO Inspector**
- SEO-only scanner
- Keyword tracking
- Competitor analysis
- Target: Marketing agencies
- Pricing: $19/month

**Shared Infrastructure:**
- Same scanner engine (modular design)
- Same auth/billing (Stripe)
- Same deployment (Vercel)
- 70%+ code reuse via monorepo

**Rationale:**
- Faster product launches (2-4 weeks)
- Cross-sell opportunities
- Diversified revenue streams
- Lower CAC (shared marketing)

---

### 9. White-Label Licensing

**Target:** Web dev agencies, hosting providers

**Features:**
- Rebrand as "YourAgency Scanner"
- Custom domain (scanner.youragency.com)
- Your logo, colors, branding
- You set pricing
- We handle infrastructure

**Revenue Model:**
- Flat fee: $499/month (unlimited scans)
- OR Revenue share: 20% of your subscription revenue

**Use Case:**
- Agency offers "free security audit" to leads
- Upsells remediation services
- Uses VibeSafe white-label under the hood

---

### 10. Self-Hosted Option

**Target:** Enterprises with strict data policies

**Deployment:**
- Docker Compose
- Kubernetes (Helm chart)
- AWS/GCP marketplace listings

**Pricing:**
- $5,000/year license
- Includes updates, support
- No per-scan fees

**Limitations:**
- No AI enrichment (requires Anthropic API)
- Customer manages database, backups
- Security updates delivered quarterly

---

## Beyond 2026

### Exploratory Ideas

**1. Browser Extension SDK**
- Let developers build custom scanners
- Example: "Shopify Security Scanner" using VibeSafe SDK

**2. Visual Regression Testing**
- Screenshot comparison before/after changes
- Detect unintended UI changes

**3. Synthetic Monitoring**
- Run scans every 1 hour
- Alert on grade degradation
- Competes with Pingdom, UptimeRobot

**4. AI-Powered Auto-Fix**
- Not just suggestions, but actual code changes
- Generate PR with fixes
- Uses AI coding tools (Cursor API)

---

## Prioritization Framework

**How We Decide What to Build:**

1. **Customer demand** (# of requests)
2. **Revenue potential** (willingness to pay)
3. **Competitive advantage** (unique vs commodity)
4. **Development effort** (ROI)
5. **Strategic alignment** (monorepo, SaaS factory)

**Current Top 3:**
1. GitHub Action (highest demand)
2. Team features (unlock Team tier)
3. Chrome extension (competitive differentiation)

---

## Contributing

**Have ideas?**
- File a GitHub issue with `feature-request` label
- Email: product@vibesafe.app
- Vote on existing proposals: vibesafe.app/roadmap

---

**Document Owner:** Product Team  
**Next Review:** End of each quarter
