# Production Deployment Guide

**Last Updated:** 2026-05-11
**Status:** Pre-Launch Checklist
**Target Platform:** Vercel (recommended) or any Node.js hosting

**✅ Latest:** Smart database config now auto-detects Vercel and gracefully handles missing variables. See `docs/DATABASE_CONFIG_IMPROVEMENTS.md` for details.

---

## 📋 Pre-Deployment Checklist

### **Phase 1: Environment Configuration**

#### **1.1 Required Environment Variables**

Copy these to your production environment (Vercel, Railway, etc.):

```bash
# ═══════════════════════════════════════════════════════════════
# CRITICAL - MUST SET BEFORE DEPLOYMENT
# ═══════════════════════════════════════════════════════════════

# ── Environment ────────────────────────────────────────────────
NODE_ENV="production"

# ── Database (PostgreSQL - REQUIRED for production) ────────────
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
# Get from: Vercel Postgres, Neon, or Supabase

# ── NextAuth (Authentication) ──────────────────────────────────
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
# Generate secret: openssl rand -base64 32

# ── API Keys ───────────────────────────────────────────────────
PAGESPEED_API_KEY="your-google-pagespeed-api-key"
# Get from: https://developers.google.com/speed/docs/insights/v5/get-started

# ═══════════════════════════════════════════════════════════════
# RECOMMENDED - FOR FULL FUNCTIONALITY
# ═══════════════════════════════════════════════════════════════

# ── LLM Enrichment (Anthropic Claude) ─────────────────────────
ANTHROPIC_API_KEY="sk-ant-xxxxxxxxxxxxx"
# Get from: https://console.anthropic.com
# Optional but highly recommended for better reports

# ── OAuth Providers (Optional) ─────────────────────────────────
GITHUB_CLIENT_ID="your-github-oauth-client-id"
GITHUB_CLIENT_SECRET="your-github-oauth-client-secret"
# Setup: https://github.com/settings/developers

GOOGLE_CLIENT_ID="your-google-oauth-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"
# Setup: https://console.cloud.google.com/apis/credentials

# ── Payments (Stripe) ──────────────────────────────────────────
STRIPE_SECRET_KEY="sk_live_xxxxxxxxxxxxx"
STRIPE_PUBLISHABLE_KEY="pk_live_xxxxxxxxxxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxx"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_xxxxxxxxxxxxx"
# Get from: https://dashboard.stripe.com/apikeys

# ── Storage (Cloudflare R2 or S3-compatible) ───────────────────
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key"
R2_SECRET_ACCESS_KEY="your-r2-secret-key"
R2_BUCKET_NAME="vibesafe-reports"
R2_PUBLIC_URL="https://your-bucket.r2.dev"
# Setup: https://dash.cloudflare.com/r2

# ── Queue (Redis - Optional, falls back to in-memory) ──────────
REDIS_URL="redis://default:password@host:6379"
# Get from: Upstash, Redis Labs, or Railway Redis

# ── Error Tracking (Sentry) ────────────────────────────────────
SENTRY_DSN="https://xxxxxxxxxxxxx@o123456.ingest.sentry.io/123456"
NEXT_PUBLIC_SENTRY_DSN="https://xxxxxxxxxxxxx@o123456.ingest.sentry.io/123456"
# Setup: https://sentry.io

# ═══════════════════════════════════════════════════════════════
# OPTIONAL - FINE-TUNING
# ═══════════════════════════════════════════════════════════════

# ── Feature Flags (JSON - all enabled by default) ──────────────
FEATURES='{}'
# Example to disable features:
# FEATURES='{"stripe":false,"tierGating":false,"llmEnrichment":false}'

# ── Rate Limiting ──────────────────────────────────────────────
RATE_LIMIT_PER_HOUR="10"

# ── Scan Configuration ─────────────────────────────────────────
SCAN_TIMEOUT_MS="120000"
MAX_CONCURRENT_SCANS="5"

# ── LLM Configuration ──────────────────────────────────────────
LLM_ENRICHMENT_ENABLED="true"
ANTHROPIC_MODEL="claude-sonnet-4-20250514"
LLM_ENRICHMENT_TIMEOUT_MS="20000"
```

---

### **Phase 2: Database Setup**

#### **2.1 PostgreSQL Database**

**Option A: Vercel Postgres (Recommended)**
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Storage" → "Create Database" → "Postgres"
3. Name it: `vibesafe-db`
4. Select region: `us-east-1` (or closest to you)
5. Click "Connect to Project"
6. Copy environment variables to Vercel project settings

**Option B: Neon**
1. Go to [neon.tech](https://neon.tech)
2. Create project: `vibesafe-db`
3. Copy connection string
4. Set as `DATABASE_URL` in Vercel

**Option C: Supabase**
1. Go to [supabase.com](https://supabase.com)
2. Create project: `vibesafe`
3. Go to Settings → Database → Connection string
4. Copy "Connection pooling" URL
5. Set as `DATABASE_URL` in Vercel

#### **2.2 Run Database Migrations**

**After deploying to Vercel:**

```bash
# Set NODE_ENV to production (already done in Vercel)
# Run deployment script (happens automatically on Vercel deploy)

# Or manually via Vercel CLI:
vercel env pull .env.production
NODE_ENV=production npm run db:deploy
```

**Vercel automatically runs:**
```json
{
  "scripts": {
    "build": "node scripts/db-config.js && next build"
  }
}
```

This will:
1. Configure Prisma schema for PostgreSQL
2. Sync schema to database via `prisma db push`
3. Generate Prisma client
4. Build Next.js app

---

### **Phase 3: Third-Party Service Setup**

#### **3.1 Anthropic (LLM Enrichment)**

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up (free trial: $5 credit)
3. Create API key
4. Set `ANTHROPIC_API_KEY` in Vercel
5. **Optional:** For Enterprise tier, contact Anthropic for zero-retention DPA

**Cost:** ~$0.001-0.005 per scan (depending on findings count)

#### **3.2 Google PageSpeed Insights API**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create project: `vibesafe`
3. Enable "PageSpeed Insights API"
4. Create API key (Credentials → Create Credentials → API Key)
5. Restrict key to "PageSpeed Insights API" only
6. Set `PAGESPEED_API_KEY` in Vercel

**Cost:** Free (25,000 requests/day)

#### **3.3 Stripe (Payments)**

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Switch to "Live mode" (top right)
3. Go to Developers → API Keys
4. Copy:
   - `STRIPE_SECRET_KEY` (sk_live_xxx)
   - `STRIPE_PUBLISHABLE_KEY` (pk_live_xxx)
5. Go to Developers → Webhooks → Add endpoint
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy `STRIPE_WEBHOOK_SECRET` (whsec_xxx)
6. Set all keys in Vercel

**Test mode available:** Use `sk_test_xxx` and `pk_test_xxx` for testing

#### **3.4 OAuth Providers (Optional)**

**GitHub:**
1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. New OAuth App
   - Application name: `VibeSafe`
   - Homepage URL: `https://your-domain.com`
   - Authorization callback URL: `https://your-domain.com/api/auth/callback/github`
3. Copy `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`

**Google:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs: `https://your-domain.com/api/auth/callback/google`
3. Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

#### **3.5 Cloudflare R2 (PDF Storage)**

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. R2 → Create bucket: `vibesafe-reports`
3. Settings → R2 API tokens → Create API token
   - Permissions: Read & Write
   - Bucket: `vibesafe-reports`
4. Copy:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
5. Set `R2_BUCKET_NAME="vibesafe-reports"`
6. Optional: Set up custom domain for public URLs

**Cost:** $0.015/GB/month storage, $0.36/million requests

#### **3.6 Redis (Optional - Job Queue)**

**Option A: Upstash (Recommended)**
1. Go to [upstash.com](https://upstash.com)
2. Create Redis database
3. Copy connection string → Set as `REDIS_URL`

**Option B: Railway**
1. Deploy Redis plugin
2. Copy connection string

**Fallback:** If not set, VibeSafe uses in-memory queue (works for low traffic)

#### **3.7 Sentry (Error Tracking)**

1. Go to [sentry.io](https://sentry.io)
2. Create project: `vibesafe` (platform: Next.js)
3. Copy DSN
4. Set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`

**Cost:** Free tier: 5,000 errors/month

---

### **Phase 4: Deploy to Vercel**

#### **4.1 Connect GitHub Repository**

1. Push code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import repository: `your-username/vibesafe`
4. Configure project:
   - Framework Preset: **Next.js**
   - Root Directory: `./`
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

#### **4.2 Set Environment Variables**

Go to Settings → Environment Variables and add all variables from Phase 1.

**Tip:** Use Vercel CLI to bulk import:
```bash
vercel env add PRODUCTION < .env.production
```

#### **4.3 Deploy**

Click "Deploy" — Vercel will:
1. Install dependencies
2. Run `npm run build` (includes database configuration)
3. Deploy to production

#### **4.4 Verify Deployment**

1. Check deployment logs for errors
2. Visit `https://your-project.vercel.app`
3. Test scan functionality
4. Check database connection (run a scan)
5. Verify PDF export works
6. Test authentication (if OAuth configured)

---

### **Phase 5: Post-Deployment**

#### **5.1 Custom Domain**

1. Vercel → Settings → Domains
2. Add domain: `vibesafe.com`
3. Configure DNS:
   ```
   Type: CNAME
   Name: @
   Value: cname.vercel-dns.com
   ```
4. Wait for SSL certificate (automatic)

#### **5.2 Update NEXTAUTH_URL**

```bash
NEXTAUTH_URL="https://vibesafe.com"
```

Redeploy after updating.

#### **5.3 Monitoring**

**Set up alerts:**
1. Vercel → Settings → Alerts
   - Deploy failed
   - Function errors > 10/hour
   - Build failed

2. Sentry → Alerts
   - New error types
   - Error spike (> 100 errors/hour)

3. Uptime monitoring (optional):
   - [UptimeRobot](https://uptimerobot.com) (free)
   - Monitor: `https://vibesafe.com/api/health`

---

### **Phase 6: Legal & Compliance**

#### **6.1 Update Legal Pages**

Before accepting payments, ensure:
- [ ] `/terms` page live with Terms of Service
- [ ] `/privacy` page live with Privacy Policy
- [ ] Footer links to Terms, Privacy, Contact
- [ ] Cookie consent banner (if using analytics)

#### **6.2 Contact Emails**

Set up and test:
- [ ] support@vibesafe.com
- [ ] legal@vibesafe.com
- [ ] privacy@vibesafe.com
- [ ] abuse@vibesafe.com
- [ ] security@vibesafe.com

#### **6.3 Compliance**

- [ ] GDPR compliance verified (if EU users)
- [ ] Stripe payment flow tested
- [ ] Refund policy documented
- [ ] Data retention policy enforced

---

## 🚀 Quick Start (Vercel One-Click Deploy)

```bash
# 1. Fork repository
# 2. Click "Deploy to Vercel" button
# 3. Set required environment variables:
#    - DATABASE_URL (from Vercel Postgres)
#    - NEXTAUTH_SECRET (generate: openssl rand -base64 32)
#    - NEXTAUTH_URL (https://your-project.vercel.app)
#    - PAGESPEED_API_KEY (from Google Cloud)
# 4. Deploy!
```

---

## ⚠️ Common Issues

### **Issue 1: Database connection failed**
**Solution:** Verify `DATABASE_URL` is set and starts with `postgresql://`

### **Issue 2: Build fails with Prisma error**
**Solution:** Ensure `NODE_ENV=production` is set. Vercel sets this automatically.

### **Issue 3: NextAuth error**
**Solution:** Set `NEXTAUTH_URL` to your production domain (not localhost)

### **Issue 4: Stripe webhook not working**
**Solution:** Verify webhook URL is `https://your-domain.com/api/webhooks/stripe` and events are selected

### **Issue 5: LLM enrichment not working**
**Solution:** Check `ANTHROPIC_API_KEY` is set and valid. View logs for API errors.

---

## 📊 Estimated Costs

| Service | Free Tier | Paid Tier | Notes |
|---------|-----------|-----------|-------|
| **Vercel** | Free (Hobby) | $20/month (Pro) | Hobby: 100GB bandwidth, unlimited projects |
| **Vercel Postgres** | $0.10/10k rows | $0.25/10k rows + $0.01/GB | Free tier: 60 hours compute |
| **Anthropic Claude** | $5 free credit | ~$0.002/scan | Optional, can disable |
| **PageSpeed API** | Free (25k/day) | N/A | Unlimited for reasonable use |
| **Stripe** | Free | 2.9% + $0.30/txn | No monthly fee |
| **Cloudflare R2** | 10 GB free | $0.015/GB | First 10 GB/month free |
| **Upstash Redis** | 10k commands/day | $0.20/100k | Optional |
| **Sentry** | 5k errors/month | $26/month | Optional |

**Total for low-traffic site:** $0-10/month  
**Total for production site:** $30-50/month

---

## ✅ Production Readiness Checklist

- [ ] All environment variables set in Vercel
- [ ] PostgreSQL database connected and migrated
- [ ] Custom domain configured with SSL
- [ ] Legal pages (`/terms`, `/privacy`) live
- [ ] Contact emails set up and tested
- [ ] Stripe webhooks configured and tested
- [ ] Error tracking (Sentry) configured
- [ ] Monitoring alerts configured
- [ ] First production scan tested end-to-end
- [ ] PDF export tested
- [ ] Payment flow tested (test mode → live mode)
- [ ] Compliance checklist reviewed (`docs/compliance/PRE_LAUNCH_CHECKLIST.md`)

---

**Ready to deploy?** Follow this guide step-by-step, and you'll have VibeSafe running in production in ~2-3 hours! 🚀
