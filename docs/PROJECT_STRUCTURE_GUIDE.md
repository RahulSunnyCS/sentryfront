# 🗂️ VibeSafe Project Structure Guide

A visual guide to understanding how the VibeSafe codebase is organized and where to find things.

---

## 📁 High-Level Overview

```
sentryfront/
├── src/                    # All source code
│   ├── app/               # Next.js App Router (routes + pages)
│   ├── components/        # Reusable React components
│   ├── lib/              # Utility functions, configs, business logic
│   └── types/            # TypeScript type definitions
│
├── docs/                  # Documentation
│   ├── NEXTJS_*.md       # Learning resources (NEW!)
│   ├── core/             # Product & technical specs
│   ├── modules/          # Scanner module docs
│   └── specs/            # Feature specifications
│
├── prisma/               # Database schema & migrations
├── public/               # Static assets (images, fonts)
├── scripts/              # Build & utility scripts
└── [config files]        # next.config.mjs, tsconfig.json, etc.
```

---

## 🎯 The `src/app/` Directory (Next.js Routes)

This is where all your routes and pages live. **Every folder = a route!**

```
src/app/
│
├── layout.tsx                 # 🌐 Root layout (wraps all pages)
├── page.tsx                   # 📄 Homepage (/)
├── globals.css                # 🎨 Global styles
│
├── about/                     # Route: /about
│   └── page.tsx
│
├── report/                    # Route: /report
│   └── [id]/                  # 🔀 Dynamic route: /report/:id
│       ├── page.tsx           # Server Component - fetches data
│       └── report-view.tsx    # Client Component - interactive UI
│
├── scan/                      # Route: /scan
│   └── [id]/                  # 🔀 Dynamic route: /scan/:id
│       ├── page.tsx
│       └── scan-progress.tsx  # Real-time scan updates
│
├── demo/                      # Route: /demo
│   ├── accessibility/
│   │   └── page.tsx           # /demo/accessibility
│   ├── performance/
│   │   └── page.tsx           # /demo/performance
│   └── seo/
│       └── page.tsx           # /demo/seo
│
├── legal/                     # Route: /legal
│   ├── privacy/
│   │   └── page.tsx           # /legal/privacy
│   ├── terms/
│   │   └── page.tsx           # /legal/terms
│   └── contact/
│       └── page.tsx           # /legal/contact
│
└── api/                       # 🔌 API Routes (backend endpoints)
    ├── auth/
    │   └── [...nextauth]/
    │       └── route.ts       # NextAuth.js authentication
    │
    ├── health/
    │   └── route.ts           # GET /api/health
    │
    ├── test-sentry/
    │   └── route.ts           # GET /api/test-sentry (dev only)
    │
    ├── v1/                    # API v1
    │   ├── scans/
    │   │   ├── route.ts       # POST /api/v1/scans (create scan)
    │   │   └── [id]/
    │   │       ├── route.ts   # GET /api/v1/scans/:id (get scan)
    │   │       └── pdf/
    │   │           └── route.ts  # GET /api/v1/scans/:id/pdf
    │   │
    │   └── checkout/
    │       └── route.ts       # POST /api/v1/checkout (Stripe)
    │
    └── webhooks/
        └── stripe/
            └── route.ts       # POST /api/webhooks/stripe
```

---

## 🧩 The `src/components/` Directory

Reusable UI components used across multiple pages.

```
src/components/
│
├── nav.tsx                    # Navigation bar (used in layout)
├── footer.tsx                 # Footer
├── providers.tsx              # 🔐 NextAuth SessionProvider wrapper
│
├── auth-button.tsx            # 👤 Sign in/out button (Client)
├── pdf-export-button.tsx      # 📄 PDF export (Client)
├── pricing-card.tsx           # 💳 Stripe pricing cards (Client)
│
├── grade-display.tsx          # 📊 A/B/C/D/F grade badge
├── severity-badge.tsx         # 🚨 Critical/High/Medium/Low badge
├── severity-summary.tsx       # 📈 Finding count by severity
├── finding-card.tsx           # 🔍 Individual security finding
│
├── performance-section.tsx    # ⚡ Performance metrics display (Client)
├── performance-grade.tsx      # 📊 Performance grade
├── core-web-vitals.tsx        # 📈 LCP, FCP, CLS charts
│
├── accessibility-section.tsx  # ♿ Accessibility results (Client)
├── accessibility-grade.tsx    # 📊 Accessibility grade
├── wcag-compliance.tsx        # ✅ WCAG compliance checker
│
├── seo-section.tsx            # 🔍 SEO analysis (Client)
├── seo-grade.tsx              # 📊 SEO grade
│
├── ai-improvement-suggestions.tsx  # 🤖 AI-powered fix suggestions
├── copy-button.tsx            # 📋 Copy to clipboard button
├── icons.tsx                  # 🎨 SVG icon components
│
├── tier-gate-banner.tsx       # 🔒 Upgrade prompt for free users
├── mock-mode-banner.tsx       # ⚠️ "Demo mode" banner
└── report-watermark.tsx       # 🏷️ White-label customization
```

**Naming Convention:**
- `*.tsx` with `'use client'` = Client Component (interactive)
- `*.tsx` without directive = Server Component (or shared)

---

## 📚 The `src/lib/` Directory

Business logic, utilities, and configuration.

```
src/lib/
│
├── auth/                      # 🔐 Authentication
│   ├── nextauth-config.ts     # NextAuth.js configuration
│   └── helpers.ts             # getCurrentUser(), etc.
│
├── mock/                      # 🎭 Demo data generators
│   ├── accessibility-data.ts
│   ├── performance-data.ts
│   └── seo-data.ts
│
├── modules/                   # 🔍 Scanner modules
│   ├── security/              # Security checks
│   ├── performance/           # Performance analysis
│   ├── accessibility/         # Accessibility audits
│   └── seo/                   # SEO checks
│
├── api.ts                     # 🌐 Browser API client (fetch wrappers)
├── prisma.ts                  # 🗄️ Prisma client singleton
├── logger.ts                  # 📝 Structured logging
├── rate-limiter.ts            # ⏱️ Rate limiting (Redis)
├── queue.ts                   # 📬 BullMQ queue setup
│
├── features.ts                # ⚙️ Server-side feature flags
├── client-features.ts         # ⚙️ Client-side feature flags
│
├── url-validator.ts           # ✅ URL validation & normalization
├── scan-worker.ts             # 🔧 Background scan orchestration
├── data.ts                    # 📊 Mock/demo scan data
├── types.ts                   # 📘 TypeScript shared types
│
└── pdf/                       # 📄 PDF generation
    └── generator.ts           # Playwright-based PDF export
```

---

## 🗄️ The `prisma/` Directory

Database schema and migrations.

```
prisma/
├── schema.prisma              # 📋 Database schema definition
├── migrations/                # 🔄 Migration history
└── vibesafe.db               # 🗃️ SQLite database (local dev)
```

**Key Models:**
- `User` - User accounts (NextAuth)
- `Scan` - Security scan records
- `Finding` - Individual vulnerabilities found
- `Account`, `Session` - NextAuth tables

---

## ⚙️ Configuration Files (Root)

```
/
├── next.config.mjs            # ⚙️ Next.js configuration
├── tsconfig.json              # 📘 TypeScript config
├── tailwind.config.ts         # 🎨 Tailwind CSS config
├── postcss.config.js          # 🎨 PostCSS config
├── vitest.config.ts           # 🧪 Vitest test config
├── .env.local                 # 🔒 Environment variables (gitignored)
├── package.json               # 📦 Dependencies & scripts
├── Dockerfile                 # 🐳 Docker image
└── docker-compose.yml         # 🐳 Local Docker setup
```

---

## 🎓 Where to Find Examples

### Want to learn about...

**File-based routing?**
- Look at: `src/app/` folder structure
- Examples: `src/app/report/[id]/page.tsx`

**Server Components?**
- Look at: `src/app/report/[id]/page.tsx`
- See direct Prisma queries

**Client Components?**
- Look at: `src/components/auth-button.tsx`
- See `'use client'` directive + hooks

**API Routes?**
- Look at: `src/app/api/v1/scans/route.ts`
- See GET/POST handlers

**Dynamic Routes?**
- Look at: `src/app/report/[id]/page.tsx`
- See `params.id` usage

**Database Queries?**
- Look at: `src/lib/prisma.ts` + usage in pages

**Authentication?**
- Look at: `src/lib/auth/nextauth-config.ts`
- See: `src/components/providers.tsx`

**Feature Flags?**
- Look at: `src/lib/features.ts` (server)
- Look at: `src/lib/client-features.ts` (client)

---

## 🔍 Quick File Finder

| I want to... | Look at... |
|--------------|-----------|
| Add a new page | `src/app/[your-route]/page.tsx` |
| Create an API endpoint | `src/app/api/[your-endpoint]/route.ts` |
| Build a component | `src/components/your-component.tsx` |
| Add business logic | `src/lib/your-module.ts` |
| Define types | `src/types/index.ts` |
| Modify database schema | `prisma/schema.prisma` |
| Configure Next.js | `next.config.mjs` |
| Add dependencies | `package.json` |

---

**Use this guide to navigate the codebase confidently! 🧭**
