# Troubleshooting Vercel 500 Error

**Error:** `POST /api/v1/scans` returns 500 Internal Server Error  
**Date:** 2026-05-11  
**Platform:** Vercel (vibesafe.codifie.dev)

---

## 🔍 Step 1: Check Vercel Logs

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: `vibesafe`
3. Click "**Functions**" tab
4. Find the failed request to `/api/v1/scans`
5. Click to view full error trace

**Look for:**
- `PrismaClientInitializationError` → Database connection issue
- `Cannot find module '@prisma/client'` → Prisma not generated
- `Missing environment variable` → Env var not set
- Any other error message

---

## 🛠️ Common Fixes

### **Fix 1: Database URL Not Set**

**Symptom:** `PrismaClientInitializationError: Can't reach database server`

**Solution:**
1. Go to Vercel → Settings → Environment Variables
2. Add `DATABASE_URL`:
   ```
   DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
   ```
3. **Important:** Set for all environments (Production, Preview, Development)
4. Redeploy

**Get Database URL from:**
- **Vercel Postgres:** Vercel → Storage → your-database → .env.local tab → Copy `POSTGRES_PRISMA_URL`
- **Neon:** [console.neon.tech](https://console.neon.tech) → Connection String
- **Supabase:** Settings → Database → Connection pooling

---

### **Fix 2: Prisma Client Not Generated**

**Symptom:** `Cannot find module '@prisma/client'`

**Solution:**

Ensure your `package.json` has the `postinstall` script:

```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

**This is already in your package.json**, so if this is the issue:

1. Go to Vercel → Deployments → Latest deployment
2. Click "**Redeploy**"
3. Check build logs for `✔ Generated Prisma Client`

---

### **Fix 3: Wrong NODE_ENV**

**Symptom:** Build succeeds but database connection fails

**Solution:**

1. Vercel → Settings → Environment Variables
2. **Remove** `NODE_ENV` if set manually (Vercel sets this automatically)
3. Or ensure it's set to `production` for Production environment
4. Redeploy

---

### **Fix 4: Database Schema Not Pushed**

**Symptom:** `Table 'Scan' does not exist in current database`

**Solution:**

Run database migration:

```bash
# Option A: Via Vercel CLI
vercel env pull .env.production
NODE_ENV=production npm run db:deploy

# Option B: Manually
npx prisma db push --schema=prisma/schema.prisma
```

**Or trigger via build:**
1. Ensure `build` script includes `db:deploy`:
   ```json
   "build": "node scripts/db-config.js && prisma db push && next build"
   ```
2. Redeploy

---

### **Fix 5: Missing NEXTAUTH_SECRET**

**Symptom:** `Error: Please define a NEXTAUTH_SECRET environment variable`

**Solution:**

1. Generate secret:
   ```bash
   openssl rand -base64 32
   ```
2. Add to Vercel environment variables:
   ```
   NEXTAUTH_SECRET=<generated-secret>
   NEXTAUTH_URL=https://vibesafe.codifie.dev
   ```
3. Redeploy

---

### **Fix 6: PAGESPEED_API_KEY Missing**

**Symptom:** Scan starts but fails during performance/accessibility/SEO analysis

**Solution:**

1. Get API key from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Add to Vercel:
   ```
   PAGESPEED_API_KEY=<your-key>
   ```
3. Redeploy

---

## 📋 Required Environment Variables Checklist

**Minimum (for basic scans):**
- [ ] `DATABASE_URL` (PostgreSQL connection string)
- [ ] `NEXTAUTH_URL` (https://vibesafe.codifie.dev)
- [ ] `NEXTAUTH_SECRET` (random 32-char string)
- [ ] `PAGESPEED_API_KEY` (Google PageSpeed API key)

**Recommended:**
- [ ] `ANTHROPIC_API_KEY` (for LLM enrichment)
- [ ] `FEATURES` (optional, defaults to all enabled)

**For full features:**
- [ ] OAuth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- [ ] Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] Storage: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

---

## 🐛 How to Debug

### **View Live Logs:**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# View logs in real-time
vercel logs --follow
```

### **Test Locally with Production ENV:**

```bash
# Pull production env vars
vercel env pull .env.production

# Set NODE_ENV
export NODE_ENV=production

# Run build
npm run build

# Test locally
npm start

# Try the API
curl -X POST http://localhost:3000/api/v1/scans \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

---

## 🔧 Quick Fix Script

Run this to check your Vercel environment:

```bash
#!/bin/bash

echo "Checking Vercel environment..."

# Check if DATABASE_URL is set
vercel env ls | grep DATABASE_URL || echo "❌ DATABASE_URL not set"

# Check if NEXTAUTH_SECRET is set
vercel env ls | grep NEXTAUTH_SECRET || echo "❌ NEXTAUTH_SECRET not set"

# Check if NEXTAUTH_URL is set
vercel env ls | grep NEXTAUTH_URL || echo "❌ NEXTAUTH_URL not set"

# Check if PAGESPEED_API_KEY is set
vercel env ls | grep PAGESPEED_API_KEY || echo "❌ PAGESPEED_API_KEY not set"

echo ""
echo "If any are missing, add them with:"
echo "vercel env add <NAME> production"
```

---

## 📞 Next Steps

1. **Check Vercel logs** for exact error message
2. **Verify DATABASE_URL** is set and correct
3. **Ensure NEXTAUTH_SECRET** is set
4. **Redeploy** after fixing environment variables
5. **Test** by creating a scan via the UI

**If still stuck, share the error message from Vercel logs and I'll help debug further!**
