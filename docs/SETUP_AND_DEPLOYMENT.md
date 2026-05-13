# Setup and Deployment Guide

**VibeSafe - Local Development & Production Deployment**  
**Last Updated:** 2026-05-13  
**Difficulty:** Beginner-friendly

---

## Table of Contents

1. [Local Development Setup](#1-local-development-setup)
2. [Environment Variables](#2-environment-variables)
3. [Running the Application](#3-running-the-application)
4. [Production Deployment (Vercel)](#4-production-deployment-vercel)
5. [Database Setup (Neon PostgreSQL)](#5-database-setup-neon-postgresql)
6. [External Services Configuration](#6-external-services-configuration)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Local Development Setup

### Prerequisites

**Required:**
- Node.js 18.x or higher ([Download](https://nodejs.org/))
- npm or pnpm (comes with Node.js)
- Git ([Download](https://git-scm.com/))

**Optional:**
- VS Code with recommended extensions (see `.vscode/extensions.json`)
- Docker (for running PostgreSQL locally)

---

### Quick Start (5 minutes)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/vibesafe.git
cd vibesafe

# 2. Install dependencies
npm install
# OR if using pnpm
pnpm install

# 3. Set up environment variables
cp .env.example .env.local

# 4. Set up database (SQLite for local dev)
npx prisma generate
npx prisma migrate dev

# 5. Start development server
npm run dev

# 6. Open browser
# Visit http://localhost:3001
```

✅ **You should now see VibeSafe running locally!**

---

## 2. Environment Variables

### Required for Local Development

Create a `.env.local` file in the project root:

```bash
# Database (SQLite for local dev)
DATABASE_URL="file:./dev.db"

# NextAuth (Authentication)
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="generate-random-secret-here"  # Run: openssl rand -base64 32

# OAuth Providers (Optional for basic testing)
GITHUB_ID="your_github_oauth_client_id"
GITHUB_SECRET="your_github_oauth_client_secret"

GOOGLE_CLIENT_ID="your_google_oauth_client_id"
GOOGLE_CLIENT_SECRET="your_google_oauth_client_secret"

# AI (Optional - enables AI insights)
ANTHROPIC_API_KEY="sk-ant-..."  # Get from https://console.anthropic.com

# Stripe (Optional - for billing testing)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Monitoring (Optional)
SENTRY_DSN="https://..."
```

---

### How to Get API Keys

**1. GitHub OAuth (for login):**
```
1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - Application name: VibeSafe Local
   - Homepage URL: http://localhost:3001
   - Authorization callback URL: http://localhost:3001/api/auth/callback/github
4. Copy Client ID and Client Secret to .env.local
```

**2. Anthropic API (for AI insights):**
```
1. Go to https://console.anthropic.com
2. Create account (or login)
3. Navigate to API Keys
4. Create new key
5. Copy to ANTHROPIC_API_KEY in .env.local
```

**3. Stripe (for billing):**
```
1. Go to https://dashboard.stripe.com/register
2. Complete signup
3. Get test keys from https://dashboard.stripe.com/test/apikeys
4. Copy Secret Key and Publishable Key
```

---

## 3. Running the Application

### Development Server

```bash
# Start dev server (with hot reload)
npm run dev

# Server will start on http://localhost:3001
```

### Database Commands

```bash
# Generate Prisma Client (after schema changes)
npx prisma generate

# Create a new migration
npx prisma migrate dev --name your_migration_name

# Open Prisma Studio (visual database editor)
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Testing Scans Locally

```bash
# 1. Start dev server
npm run dev

# 2. Open http://localhost:3001

# 3. Enter test URLs:
# - example.com (basic test)
# - github.com (good security)
# - httpbin.org (CORS testing)

# 4. View results in terminal and browser
```

---

## 4. Production Deployment (Vercel)

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/vibesafe)

Click the button above and follow the prompts.

---

### Manual Deployment

**Step 1: Create Vercel Account**
```
1. Go to https://vercel.com/signup
2. Sign up with GitHub
3. Install Vercel CLI (optional):
   npm install -g vercel
```

**Step 2: Connect Repository**
```
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Framework Preset: Next.js
4. Root Directory: ./
5. Build Command: (auto-detected)
6. Output Directory: (auto-detected)
```

**Step 3: Configure Environment Variables**
```
In Vercel Dashboard > Project > Settings > Environment Variables:

Add all variables from .env.local (see Section 2)

IMPORTANT: Use production values, not test keys!
- DATABASE_URL: Use Neon PostgreSQL connection string
- NEXTAUTH_URL: https://yourdomain.com
- STRIPE_SECRET_KEY: Use live key (sk_live_...)
- etc.
```

**Step 4: Deploy**
```bash
# Option A: Push to main branch (auto-deploys)
git push origin main

# Option B: Manual deploy via CLI
vercel --prod
```

✅ **Your site will be live at `https://your-project.vercel.app`**

---

## 5. Database Setup (Neon PostgreSQL)

### Why PostgreSQL for Production?

- SQLite works for local dev, but PostgreSQL is required for production
- Neon offers serverless PostgreSQL (pay-as-you-go)
- Free tier: 500MB storage, 512MB RAM

---

### Setup Neon Database

**Step 1: Create Neon Account**
```
1. Go to https://neon.tech
2. Sign up (free tier available)
3. Create new project: "vibesafe-production"
```

**Step 2: Get Connection String**
```
1. In Neon dashboard, click "Connection Details"
2. Copy the connection string:
   postgresql://user:password@host.region.neon.tech/dbname?sslmode=require

3. Add to Vercel environment variables:
   DATABASE_URL="postgresql://..."
```

**Step 3: Run Migrations**
```bash
# Set DATABASE_URL locally (temporary)
export DATABASE_URL="postgresql://your-neon-connection-string"

# Run migrations
npx prisma migrate deploy

# Verify
npx prisma studio
```

---

## 6. External Services Configuration

### Sentry (Error Tracking)

```bash
# 1. Create account at https://sentry.io
# 2. Create new project (Next.js)
# 3. Copy DSN
# 4. Add to Vercel environment variables:
SENTRY_DSN="https://...@sentry.io/..."

# 5. Initialize Sentry (already done in codebase)
# See: src/lib/sentry.ts
```

---

### Stripe Webhooks (Production)

```bash
# 1. In Stripe Dashboard > Developers > Webhooks
# 2. Add endpoint: https://yourdomain.com/api/webhooks/stripe
# 3. Select events:
#    - customer.subscription.created
#    - customer.subscription.updated
#    - customer.subscription.deleted
#    - invoice.paid
#    - invoice.payment_failed

# 4. Copy webhook signing secret
# 5. Add to Vercel:
STRIPE_WEBHOOK_SECRET="whsec_..."
```

---

### Cloudflare R2 (PDF Storage)

```bash
# 1. Create Cloudflare account
# 2. Go to R2 > Create bucket: "vibesafe-pdfs"
# 3. Get credentials (Access Key ID, Secret Access Key)
# 4. Add to Vercel:
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="vibesafe-pdfs"
R2_ENDPOINT="https://..."
```

---

## 7. Troubleshooting

### Common Issues

**1. "Module not found" errors**
```bash
# Solution: Clear cache and reinstall
rm -rf node_modules .next
npm install
npm run dev
```

**2. Database connection errors**
```bash
# Solution: Regenerate Prisma Client
npx prisma generate
npx prisma migrate dev
```

**3. Port 3001 already in use**
```bash
# Solution A: Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Solution B: Use different port
PORT=3002 npm run dev
```

**4. NextAuth redirect loop**
```bash
# Solution: Check NEXTAUTH_URL matches your domain
# Local: http://localhost:3001
# Production: https://yourdomain.com
```

**5. Stripe webhook failing**
```bash
# Solution: Test locally with Stripe CLI
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```

---

### Getting Help

**Documentation:**
- Next.js: https://nextjs.org/docs
- Prisma: https://www.prisma.io/docs
- Vercel: https://vercel.com/docs

**Community:**
- GitHub Issues: https://github.com/yourusername/vibesafe/issues
- Email: support@vibesafe.app

---

**Document Owner:** DevOps Team  
**Next Review:** 2026-06-01  
**Questions?** File a GitHub issue or email devops@vibesafe.app
