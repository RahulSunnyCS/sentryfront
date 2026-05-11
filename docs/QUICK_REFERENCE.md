# Quick Reference Guide

**Last Updated:** 2026-05-11  
**Purpose:** Fast access to common commands, links, and configurations

---

## 🚀 Development Commands

```bash
# Start development server (SQLite auto-configured)
npm run dev

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- path/to/file.test.ts

# Run build (checks for errors)
npm run build

# Type check (no build)
npm run typecheck

# Lint code
npm run lint

# Format code
npm run format
```

---

## 🗄️ Database Commands

```bash
# SQLite (Development - Default)
npm run db:migrate        # Run migrations
npm run db:reset          # Reset database
npm run db:studio         # Open Prisma Studio GUI

# PostgreSQL (Production)
npm run db:deploy         # Deploy schema to production
npm run db:push           # Alternative: push without migrations

# Manual Configuration
node scripts/db-config.js development   # Switch to SQLite
node scripts/db-config.js production    # Switch to PostgreSQL

# Prisma Commands
npx prisma generate       # Generate Prisma Client
npx prisma db push        # Push schema changes (no migrations)
npx prisma migrate dev    # Create and apply migration
npx prisma studio         # Open database GUI
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run specific test
npm test -- src/lib/llm/__tests__/enrichment.test.ts

# Run coverage
npm run test:coverage

# Test feature flags
node scripts/test-features.js
```

---

## 📝 Important File Locations

### **Configuration**
- `.env` — Local environment variables
- `.env.example` — Template for environment setup
- `prisma/schema.prisma` — Database schema
- `package.json` — Dependencies and scripts

### **Documentation**
- `docs/PHASES.md` — Implementation phases and roadmap
- `docs/DATABASE_SETUP.md` — Database configuration guide
- `docs/ENV_MIGRATION_GUIDE.md` — Environment variable migration
- `docs/PRODUCTION_DEPLOYMENT.md` — Production deployment checklist
- `docs/SESSION_SUMMARY.md` — Latest session summary

### **Compliance**
- `docs/compliance/TERMS_OF_SERVICE.md` — Legal terms
- `docs/compliance/PRIVACY_POLICY.md` — Privacy policy
- `docs/compliance/DATA_GOVERNANCE.md` — Data handling policy
- `docs/compliance/PRE_LAUNCH_CHECKLIST.md` — Launch readiness
- `docs/compliance/LLM_SAFETY_AUDIT.md` — LLM security audit

### **Core Code**
- `src/app/` — Next.js App Router pages
- `src/app/api/` — API routes
- `src/lib/scanner/` — Security scanning modules
- `src/lib/llm/` — LLM enrichment
- `src/lib/features.ts` — Feature flag management

---

## 🔧 Environment Variables

### **Required (Minimum)**
```bash
NODE_ENV="development"                    # or "production"
DEV_DATABASE_URL="file:./vibesafe.db"     # SQLite for dev
DATABASE_URL="postgresql://..."           # PostgreSQL for prod
NEXTAUTH_URL="http://localhost:3000"      # Your domain
NEXTAUTH_SECRET="generate-random-32char"  # openssl rand -base64 32
PAGESPEED_API_KEY="your-google-api-key"   # Google PageSpeed API
```

### **Recommended**
```bash
ANTHROPIC_API_KEY="sk-ant-xxx"            # LLM enrichment
FEATURES='{}'                              # Feature flags (JSON)
```

### **Optional (Full Features)**
```bash
# OAuth
GITHUB_CLIENT_ID="xxx"
GITHUB_CLIENT_SECRET="xxx"
GOOGLE_CLIENT_ID="xxx"
GOOGLE_CLIENT_SECRET="xxx"

# Payments
STRIPE_SECRET_KEY="sk_live_xxx"
STRIPE_PUBLISHABLE_KEY="pk_live_xxx"
STRIPE_WEBHOOK_SECRET="whsec_xxx"

# Storage
R2_ACCOUNT_ID="xxx"
R2_ACCESS_KEY_ID="xxx"
R2_SECRET_ACCESS_KEY="xxx"
R2_BUCKET_NAME="vibesafe-reports"

# Queue
REDIS_URL="redis://..."

# Monitoring
SENTRY_DSN="https://..."
```

---

## 🎯 Feature Flags

```bash
# All features enabled by default
FEATURES='{}'

# Disable specific features
FEATURES='{
  "stripe": false,
  "tierGating": false,
  "llmEnrichment": false,
  "performanceScanning": false,
  "accessibilityScanning": false,
  "seoScanning": false
}'

# Test current configuration
node scripts/test-features.js
```

---

## 📚 Key Links

### **External Services**
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Anthropic Console](https://console.anthropic.com)
- [Google Cloud Console](https://console.cloud.google.com)
- [Stripe Dashboard](https://dashboard.stripe.com)
- [GitHub OAuth Apps](https://github.com/settings/developers)
- [Sentry Dashboard](https://sentry.io)
- [Neon Console](https://console.neon.tech)

### **Documentation**
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Vitest Docs](https://vitest.dev)
- [Lighthouse API](https://developer.chrome.com/docs/lighthouse)
- [Anthropic API](https://docs.anthropic.com/claude/reference)

---

## 🐛 Troubleshooting

### **Database Issues**
```bash
# Reset Prisma client
rm -rf node_modules/.prisma
npx prisma generate

# Reset database
npm run db:reset

# Switch database provider
node scripts/db-config.js development  # SQLite
node scripts/db-config.js production   # PostgreSQL
```

### **Build Errors**
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Type check
npm run typecheck
```

### **Test Failures**
```bash
# Clear test cache
npx vitest run --clearCache

# Run specific test
npm test -- path/to/failing-test.test.ts

# Debug mode
npm test -- --inspect-brk
```

---

## ⚡ Quick Wins

### **Run a Full Test**
```bash
npm run build && npm test
```

### **Check Compliance**
```bash
cat docs/compliance/PRE_LAUNCH_CHECKLIST.md | grep "\\[ \\]"
```

### **Generate New Secret**
```bash
openssl rand -base64 32
```

### **Check Database**
```bash
npx prisma studio
```

### **View Current Config**
```bash
node scripts/db-config.js
node scripts/test-features.js
```

---

## 📊 Current Project Status

**Phase:** Phase 7 (Compliance & Legal) — 70% complete  
**Next Phase:** Phase 8 (Hardening & Beta Launch)  
**Database:** Smart switching (SQLite dev, PostgreSQL prod)  
**Features:** Security, Performance, Accessibility, SEO scanning  
**Tests:** All passing ✅  
**Build:** Passing ✅  

**See:** `docs/SESSION_SUMMARY.md` for latest updates
