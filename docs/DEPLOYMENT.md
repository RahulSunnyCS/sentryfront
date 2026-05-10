# VibeSafe Deployment Guide

Complete guide for deploying VibeSafe to production.

---

## 📋 Pre-Deployment Checklist

### Required Steps
- [ ] Install dependencies (`npm install`)
- [ ] Set up database (`npx prisma generate && npx prisma migrate dev`)
- [ ] Test scanner locally (scan at least 3 different websites)
- [ ] Review and update legal pages (Terms, Privacy Policy)
- [ ] Configure production environment variables
- [ ] Set up Sentry for error tracking (optional but recommended)
- [ ] Set up Stripe products and webhooks (if using payments)
- [ ] Test authentication flow (if enabled)

### Optional Steps
- [ ] Set up custom domain
- [ ] Configure Cloudflare R2 for PDF export
- [ ] Set up NextAuth providers (GitHub, Google)
- [ ] Add analytics (Vercel Analytics, Plausible, etc.)
- [ ] Create demo video/screenshots

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database
```bash
# Generate Prisma client
npx prisma generate

# Run migrations (creates SQLite database by default)
npx prisma migrate dev

# Optional: View database in Prisma Studio
npx prisma studio
```

### 3. Configure Environment
```bash
# Copy example environment file
cp .env.example .env

# Edit .env and configure at minimum:
# - DATABASE_URL (defaults to SQLite, fine for testing)
```

### 4. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` and test a scan!

---

## 🧪 Testing Locally

### Test a Basic Scan
1. Go to `http://localhost:3000`
2. Enter a URL (try `example.com` or `github.com`)
3. Watch the scan progress
4. Verify the report shows findings

### Test All Features
```bash
# Test different URLs to trigger different modules:
- example.com          # Basic headers, TLS
- github.com           # Good security headers
- httpbin.org          # CORS testing
- archive.org          # Mixed content, third-party scripts
```

### Check Logs
Watch the terminal for structured logs showing:
- Scan progress
- Module execution
- LLM enrichment status (if configured)
- Any errors or warnings

---

## 🌐 Deployment to Vercel (Recommended)

### Prerequisites
- Vercel account (free tier works)
- GitHub repository with your code
- PostgreSQL database (Vercel Postgres or external)

### Steps

#### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

#### 2. Import to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Configure build settings (Next.js auto-detected)

#### 3. Add Environment Variables
In Vercel dashboard → Settings → Environment Variables, add:

**Required:**
```bash
DATABASE_URL="postgresql://user:pass@host:5432/vibesafe"
```

**Optional (Phase 6-8 features):**
```bash
# Sentry (recommended for production)
SENTRY_ENABLED="true"
SENTRY_DSN="https://xxx@xxx.ingest.sentry.io/xxx"
NEXT_PUBLIC_SENTRY_ENABLED="true"
NEXT_PUBLIC_SENTRY_DSN="https://xxx@xxx.ingest.sentry.io/xxx"

# Anthropic (LLM enrichment)
ANTHROPIC_API_KEY="sk-ant-xxxxx"
LLM_ENRICHMENT_ENABLED="true"

# Stripe (payments)
STRIPE_ENABLED="true"
STRIPE_SECRET_KEY="sk_live_xxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxx"
NEXT_PUBLIC_STRIPE_ENABLED="true"

# NextAuth (authentication)
AUTH_ENABLED="true"
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"
GITHUB_ID="your-github-oauth-id"
GITHUB_SECRET="your-github-oauth-secret"

# Cloudflare R2 (PDF export)
PDF_EXPORT_ENABLED="true"
CLOUDFLARE_R2_ACCOUNT_ID="xxxxx"
CLOUDFLARE_R2_ACCESS_KEY_ID="xxxxx"
CLOUDFLARE_R2_SECRET_ACCESS_KEY="xxxxx"
CLOUDFLARE_R2_BUCKET_NAME="vibesafe-pdfs"
```

#### 4. Deploy
Click "Deploy" and wait for build to complete!

---

## 🗄️ Database Setup (Production)

### Option 1: Vercel Postgres (Easiest)
1. In Vercel dashboard → Storage → Create Database
2. Choose "Postgres"
3. Copy connection string to `DATABASE_URL`
4. Run migrations:
```bash
npx prisma migrate deploy
```

### Option 2: External PostgreSQL
Use any PostgreSQL provider:
- [Supabase](https://supabase.com) (has free tier)
- [Neon](https://neon.tech) (serverless Postgres)
- [Railway](https://railway.app)
- [Render](https://render.com)

Connection string format:
```
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
```

---

## 🔧 Post-Deployment Configuration

### Set Up Stripe Webhooks
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.vercel.app/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### Set Up Sentry
1. Create project at [sentry.io](https://sentry.io)
2. Copy DSN to environment variables
3. Verify errors are being tracked

### Configure NextAuth Providers
For GitHub OAuth:
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create new app with callback: `https://your-domain.vercel.app/api/auth/callback/github`
3. Copy Client ID and Secret to environment variables

---

## ✅ Verify Deployment

### Health Check
```bash
curl https://your-domain.vercel.app/api/health
```

Should return:
```json
{
  "status": "ok",
  "version": "abc1234",
  "db": { "type": "postgres", "status": "ok" },
  "features": { ... },
  "monitoring": { "sentry": true }
}
```

### Test Scan
1. Visit your deployed URL
2. Submit a scan
3. Verify report loads correctly

### Monitor Logs
- Vercel: Dashboard → Deployments → Runtime Logs
- Sentry: Check for errors

---

## 🐛 Troubleshooting

### Build Fails
- Check Next.js version compatibility
- Verify all dependencies are in `package.json`
- Check Prisma schema is valid

### Database Connection Errors
- Verify `DATABASE_URL` is correct
- Check SSL mode is enabled for cloud databases
- Run `npx prisma migrate deploy`

### Scans Timeout
- Increase `SCAN_TIMEOUT_MS` (default: 120000)
- Check Vercel function timeout limits (10s on hobby, 60s on pro)

### Rate Limit Issues
- Adjust `RATE_LIMIT_PER_HOUR` (default: 10)
- Check database is storing scan records

---

## 📊 Monitoring

### Key Metrics to Track
- Scan success rate
- Average scan duration
- Error rate (via Sentry)
- API response times
- Database query performance

### Recommended Tools
- **Sentry**: Error tracking (already integrated)
- **Vercel Analytics**: Traffic and performance
- **Uptime Robot**: Health check monitoring
- **Axiom**: Log aggregation (optional)

---

## 🚦 Launch Checklist

Before announcing publicly:
- [ ] Legal pages reviewed (Terms, Privacy)
- [ ] Sentry configured and tested
- [ ] Rate limiting tested
- [ ] Stripe webhooks verified (if using payments)
- [ ] Custom domain configured (optional)
- [ ] Demo report created (`/report/demo`)
- [ ] Screenshots/video prepared
- [ ] Social media accounts set up
- [ ] Launch announcement drafted

---

## 📞 Support

For deployment issues:
- **Documentation**: This file
- **Health Endpoint**: `/api/health`
- **Logs**: Check Vercel dashboard or Sentry

**VibeSafe is ready to ship! 🎉**
