# VibeSafe 🛡️

[![Tests](https://github.com/rahulsunnycs/sentryfront/actions/workflows/test.yml/badge.svg)](https://github.com/rahulsunnycs/sentryfront/actions/workflows/test.yml)

**Complete Web Quality Platform: Security, Performance, Accessibility & SEO**

Scan any website for security vulnerabilities, performance bottlenecks, accessibility issues (WCAG 2.2 AA criteria via Lighthouse), and SEO problems — with AI-enhanced remediation.

---

## ✨ Features

### **Security Scanning**
- 🔍 **18 Security Modules** - Client secrets, XSS, CSP, CORS, and more
- 🤖 **AI-Powered Enrichment** - Claude explains findings in plain English

### **Compliance Signal Detection** ✅
- ⚖️ **Passive GDPR, CCPA, WCAG Signals** - Cookie consent, privacy policy, data protection headers, accessibility
- 🔍 **6 Compliance Detection Modules** - No legal attestation — honest signal detection only
- 📋 **No Architecture Changes** - Feature flag `complianceScanning` (default on)

### **Performance Scanning** ✅
- ⚡ **Core Web Vitals** - LCP, FCP, CLS, TBT analysis via Lighthouse
- 📊 **Lighthouse-Accurate Score** - Matches Google PageSpeed Insights exactly (the old double-penalty on LCP/CLS has been removed so your VibeSafe score equals what you see on PageSpeed)
- 👥 **Real-User Field Data (CrUX)** - Google's verbatim FAST / AVERAGE / SLOW verdict from Chrome User Experience Report shown alongside the lab score — no extra API call
- 🏅 **Web Best Practices Grade** - Surfaces best-practices issues from the same PageSpeed call (module P2-08)
- ⚠️ **Field vs Lab Mismatch Alert** - When real Chrome users are slow despite a passing lab score, a prominent finding flags the gap (module P2-07)
- 🔄 **Graceful Degradation** - If PageSpeed is rate-limited or unavailable, performance is reported as "not measured" (grade N/A) instead of a misleading F
- ⚡ **Result Cache** - Performance results are cached for ~5 minutes (configurable via `PSI_CACHE_TTL_MS`) to reduce quota usage; an explicit re-scan always bypasses the cache
- 🖥️ **Optional Desktop Score** - Off by default; enable with `"desktopPerformance": true` in the `FEATURES` env JSON. Mobile remains the headline grade; desktop is shown as a clearly-labelled secondary score (never averaged with mobile)
- 💡 **AI Optimization** - File-specific improvement suggestions

### **Accessibility Scanning** ✅
- ♿ **WCAG 2.2 AA criteria** - Subset evaluated via Lighthouse's accessibility audit
- 🎨 **Color Contrast** - Text and UI component analysis
- 🎯 **Screen Reader Support** - Alt text, ARIA, semantic HTML

### **SEO Scanning** ✅
- 🔍 **Meta Tags & Titles** - Page metadata optimization
- 📱 **Social Media** - Open Graph & Twitter Cards
- 📊 **Structured Data** - Schema.org JSON-LD validation
- 🤖 **Crawlability** - robots.txt, sitemap, indexing
- 📲 **Mobile SEO** - Mobile-first indexing checks

### **Reporting & Export**
- 📄 **PDF Export** - Download professional reports
- 🎯 **Zero Cloud Costs** - No storage, optional AI (~$0.001/scan)
- 🔐 **NextAuth** - GitHub & Google OAuth support
- 📊 **Error Monitoring** - Sentry integration
- 🚀 **Production Ready** - Deploy to Vercel, Railway, or Fly.io

---

## 🎓 Learning Next.js?

**New to Next.js but know React?** This project is perfect for learning!

📚 **[Start Here: Next.js Learning Guide](./LEARNING_SUMMARY.md)**

We've created comprehensive learning resources:
- 📖 React vs Next.js comparison
- 📚 Complete Next.js 14 guide
- ⚡ Quick reference cheat sheet
- 🎯 Hands-on exercises with solutions
- 🗂️ Project structure walkthrough

**All documentation:** [`docs/`](./docs/)

---

## 🚀 Quick Start

### **1. Install Dependencies**

```bash
npm install
```

### **2. Setup Database**

```bash
npx prisma migrate dev --name init
```

### **3. Configure Environment**

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

**Required:**
```env
DATABASE_URL="file:./prisma/vibesafe.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"
```

**Optional (for AI enrichment):**
```env
ANTHROPIC_API_KEY="sk-ant-..."
LLM_ENRICHMENT_ENABLED="true"
```

### **4. Run Development Server**

```bash
npm run dev
```

Visit: **http://localhost:3000**

---

## 📖 Documentation

- **[Quick Start Guide](docs/QUICK_START.md)** - Get started in 5 minutes
- **[Setup Guide](docs/setup.md)** - Detailed installation instructions
- **[Configure Features](docs/CONFIGURE_FEATURES.md)** - Enable LLM, PDF, Auth
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Deploy to production
- **[Testing Guide](docs/TESTING.md)** - Run tests and verify functionality
- **[Development Phases](docs/PHASES.md)** - Feature roadmap

---

## 🎯 What's Included

### **Security Modules (18):**
1. Client-Side Secret Exposure (API keys, tokens)
2. Missing Security Headers (CSP, HSTS, X-Frame-Options)
3. CORS Misconfiguration
4. Dependency Vulnerabilities (npm audit)
5. SSL/TLS Issues
6. Cookie Security
7. HTTP Security
8. Information Disclosure
9. Known Vulnerabilities (Nuclei)
10. Outdated Software Detection
11. Subdomain Enumeration
12. Technology Fingerprinting
13. WAF Detection
14. CDN Detection
15. DNSSEC Configuration
16. DNS Pinning
17. Cookie Flags Validation
18. Clickjacking Protections

### **Compliance Signal Detection Modules (6):**
1. GDPR/CCPA Cookie Consent Detection
2. Privacy Policy Detection
3. Data Protection Headers
4. WCAG 2.2 Signal Detection
5. Third-Party Data Sharing Analysis
6. User Rights Implementation Check

> **Note:** Compliance modules detect signals, not attest compliance. See [Compliance Modules Documentation](docs/modules/COMPLIANCE_MODULES.md) for details.

### **Tech Stack:**
- **Framework:** Next.js 14 (App Router)
- **Database:** Prisma + SQLite (or PostgreSQL for production)
- **Auth:** NextAuth.js (GitHub, Google)
- **AI:** Anthropic Claude Sonnet 4
- **Monitoring:** Sentry
- **PDF:** Playwright

---

## 💰 Cost Breakdown

| Feature | Cost per Scan |
|---------|---------------|
| Deterministic Scan | $0.00 |
| AI Enrichment (optional) | ~$0.001 |
| PDF Export | $0.00 |
| **Total** | ~$0.001 |

**Free tier:** $5 Anthropic credit = ~5,000 scans!

---

## 🔧 Environment Variables

See [`.env.example`](.env.example) for all available options.

**Core:**
- `DATABASE_URL` - Database connection string
- `NEXTAUTH_URL` - App URL
- `NEXTAUTH_SECRET` - Auth secret key

**Optional:**
- `ANTHROPIC_API_KEY` - For AI enrichment
- `LLM_ENRICHMENT_ENABLED` - Enable/disable LLM
- `PDF_EXPORT_ENABLED` - Enable/disable PDF export
- `SENTRY_DSN` - Error monitoring

---

## 🧪 Testing

```bash
# Run a test scan
npm run dev
# Visit http://localhost:3000
# Enter a URL and click "Scan"
```

The end-to-end (Playwright) run publishes a `playwright-report` artifact that can be downloaded directly from the GitHub Actions run page.

---

## 📦 Deployment

### **Vercel (Recommended)**

```bash
vercel deploy
```

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

---

## 📄 License

MIT

---

## 🤝 Contributing

PRs welcome! See [PHASES.md](docs/PHASES.md) for planned features.

---

## 📚 Learn More

- [Full Documentation](docs/)
- [Feature Configuration](docs/CONFIGURE_FEATURES.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

---

**Built with ❤️ using Next.js, Prisma, and Claude AI**
