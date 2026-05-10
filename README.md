# VibeSafe 🛡️

**Complete Web Quality Platform: Security, Performance, Accessibility & SEO**

Scan any website for security vulnerabilities, performance bottlenecks, WCAG 2.2 compliance, and SEO optimization with AI-enhanced remediation.

---

## ✨ Features

### **Security Scanning**
- 🔍 **15 Security Modules** - Client secrets, XSS, CSP, CORS, and more
- 🤖 **AI-Powered Enrichment** - Claude explains findings in plain English

### **Performance Scanning** ✅
- ⚡ **Core Web Vitals** - LCP, FCP, CLS, TBT analysis
- 📊 **Lighthouse Integration** - Google PageSpeed Insights API
- 💡 **AI Optimization** - File-specific improvement suggestions

### **Accessibility Scanning** ✅
- ♿ **WCAG 2.2 Level AA** - Legal compliance checking
- 🎨 **Color Contrast** - Text and UI component analysis
- 🎯 **Screen Reader Support** - Alt text, ARIA, semantic HTML

### **SEO Scanning** ✅
- 🔍 **Meta Tags & Titles** - Page metadata optimization
- 📱 **Social Media** - Open Graph & Twitter Cards
- 📊 **Structured Data** - Schema.org JSON-LD validation
- 🤖 **Crawlability** - robots.txt, sitemap, indexing
- 📲 **Mobile SEO** - Mobile-first indexing compliance

### **Reporting & Export**
- 📄 **PDF Export** - Download professional reports
- 🎯 **Zero Cloud Costs** - No storage, optional AI (~$0.001/scan)
- 🔐 **NextAuth** - GitHub & Google OAuth support
- 📊 **Error Monitoring** - Sentry integration
- 🚀 **Production Ready** - Deploy to Vercel, Railway, or Fly.io

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

### **Security Modules:**
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
15. Performance & Best Practices

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
