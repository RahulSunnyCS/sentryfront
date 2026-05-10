# VibeSafe 🛡️

**Security scanner for AI-built websites.** Paste a URL, get a comprehensive security report in under 90 seconds.

[![Status](https://img.shields.io/badge/status-production--ready-brightgreen)](LAUNCH_SUMMARY.md)
[![License](https://img.shields.io/badge/license-MIT-blue)](#)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)

---

## 🎯 What is VibeSafe?

VibeSafe is a **production-ready security scanner** designed for websites built with AI coding tools like Cursor, Lovable, Bolt, and v0.

**Key Features:**
- ✅ **15 Security Checks** - Secrets, headers, TLS, cookies, CORS, and more
- 🤖 **AI-Powered** - Claude Sonnet 4 generates explanations and fix prompts
- ⚡ **Fast** - Complete analysis in ~10-20 seconds
- 📊 **Professional Reports** - Letter grades, severity breakdowns, actionable fixes
- 💰 **Monetization Ready** - Stripe integration with 4 pricing tiers
- 🔐 **Production Hardened** - Rate limiting, error tracking, legal compliance

**Status:** ✅ Production Ready - All 8 phases complete!

---

## 🚀 Quick Start

### Run Locally (Zero Config)
```bash
npm install
npx prisma migrate dev
npm run dev
```

Visit **http://localhost:3001** and scan `example.com`!

### Deploy to Vercel (5 Minutes)
See [QUICK_START.md](QUICK_START.md) or [DEPLOYMENT.md](DEPLOYMENT.md)

---

## ✨ What's Included

### ✅ Core Scanning (Phases 3-5)
**15 Detection Modules:**
- Secrets & API keys (700+ patterns)
- Security headers (CSP, HSTS, etc.)
- TLS/SSL configuration
- Cookie security
- CORS misconfiguration
- Sensitive path exposure
- Mixed content detection
- Third-party scripts
- DNS/Email security
- Subdomain takeover
- Error disclosure
- Dev interfaces
- Robots.txt analysis
- Cache control issues

**AI Enrichment:**
- Plain-English explanations
- Business impact analysis
- Copy-ready fix prompts

### ✅ Monetization & Auth (Phase 6)
- Stripe integration (4 pricing tiers)
- NextAuth with GitHub/Google OAuth
- Tier-based gating
- PDF export (Cloudflare R2)
- Scan diff/comparison

### ✅ Compliance & Legal (Phase 7)
- Terms of Service & Privacy Policy
- GDPR/CCPA compliance
- SBOM generation
- License audit (CI/CD)
- Compliance documentation

### ✅ Production Hardening (Phase 8)
- Sentry error tracking
- Enhanced rate limiting
- Scan timeout enforcement
- Input hardening (cloud metadata blocking)
- Structured logging

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [LAUNCH_SUMMARY.md](LAUNCH_SUMMARY.md) | **START HERE** - Complete overview |
| [QUICK_START.md](QUICK_START.md) | Get running in 5 minutes |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deployment guide |
| [TESTING.md](TESTING.md) | Testing checklist |
| [PHASES.md](PHASES.md) | Implementation roadmap |

**Server Running:** http://localhost:3001 ✅

---

## 🧪 Try It Now

The dev server is running at **http://localhost:3001**

Test URLs:
- `example.com` - Basic headers
- `github.com` - Good security
- `httpbin.org` - CORS testing

---

## 🏗️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Prisma + SQLite/PostgreSQL
- **AI:** Anthropic Claude Sonnet 4
- **Auth:** NextAuth.js
- **Payments:** Stripe
- **Monitoring:** Sentry
- **Deployment:** Vercel

---

## 📞 Support

- **Health Check:** http://localhost:3001/api/health
- **Demo Report:** http://localhost:3001/report/demo
- **Documentation:** See files above

---

**VibeSafe is production-ready and ready to deploy! 🚀**

See [LAUNCH_SUMMARY.md](LAUNCH_SUMMARY.md) for next steps.
