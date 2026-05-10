# 🚀 VibeSafe Deployment Checklist

Use this checklist to deploy VibeSafe to Vercel step-by-step.

---

## ✅ Pre-Deployment Checklist

### **Local Setup**
- [x] Code is working locally (`npm run dev`)
- [x] All tests pass
- [x] Environment variables are documented in `.env.example`
- [x] Database migrations are up to date
- [x] Git repository is initialized
- [x] Code is committed to git

### **GitHub**
- [ ] Code is pushed to GitHub
- [ ] Repository is public or accessible to Vercel
- [ ] Branch `main` or `master` is up to date

---

## 🔧 Deployment Steps

### **1. Setup Database** ⏱️ 5 minutes

**Option A: Vercel Postgres (Recommended)**
- [ ] Go to https://vercel.com
- [ ] Create account / Log in
- [ ] Will set up after project import

**Option B: Neon (Free)**
- [ ] Go to https://neon.tech
- [ ] Create free account
- [ ] Create new project
- [ ] Copy connection string (save for later)

---

### **2. Push to GitHub** ⏱️ 2 minutes

```bash
# Check current status
git status

# Stage all changes
git add .

# Commit
git commit -m "Ready for Vercel deployment"

# Push to GitHub
git push origin phase-complete  # or main/master
```

---

### **3. Import to Vercel** ⏱️ 3 minutes

- [ ] Go to https://vercel.com/new
- [ ] Click **Import Git Repository**
- [ ] Select your GitHub repository: `RahulSunnyCS/sentryfront`
- [ ] Configure:
  - **Framework:** Next.js (auto-detected)
  - **Root Directory:** `./`
  - **Build Command:** `prisma generate && next build` (or leave default)
  - **Install Command:** `npm install`

**⚠️ Don't click Deploy yet!** We need to set environment variables first.

---

### **4. Configure Environment Variables** ⏱️ 5 minutes

In the Vercel import screen, click **Environment Variables** section.

#### **Required Variables:**

```env
# Database (from Neon or will be added by Vercel Postgres)
DATABASE_URL=postgresql://user:password@host/database

# NextAuth
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# Auth Providers (if using GitHub/Google OAuth)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

#### **Optional Variables:**

```env
# LLM Enrichment
ANTHROPIC_API_KEY=sk-ant-...
LLM_ENRICHMENT_ENABLED=true
LLM_ENRICHMENT_TIMEOUT_MS=20000

# Features
PDF_EXPORT_ENABLED=true
FEATURE_SCAN_DIFF_ENABLED=true
TIER_GATING_ENABLED=false

# Monitoring
SENTRY_DSN=your-sentry-dsn
SENTRY_AUTH_TOKEN=your-sentry-auth-token
```

#### **Generate NEXTAUTH_SECRET:**

```bash
openssl rand -base64 32
```

Copy the output and paste as `NEXTAUTH_SECRET`.

---

### **5. Deploy!** ⏱️ 3-5 minutes

- [ ] Click **Deploy** button
- [ ] Wait for build to complete (check logs)
- [ ] Deployment successful? ✅

Your app will be live at: `https://your-app-name.vercel.app`

---

### **6. Run Database Migrations** ⏱️ 2 minutes

After first deployment, run migrations:

```bash
# Set production database URL temporarily
export DATABASE_URL="postgresql://your-production-db-url"

# Run migrations
npx prisma migrate deploy

# Verify tables created
npx prisma studio
```

---

### **7. Configure OAuth Redirects** ⏱️ 3 minutes

#### **GitHub OAuth:**
1. [ ] Go to https://github.com/settings/developers
2. [ ] Find your OAuth App
3. [ ] Update **Authorization callback URL:**
   ```
   https://your-app.vercel.app/api/auth/callback/github
   ```

#### **Google OAuth:**
1. [ ] Go to https://console.cloud.google.com/apis/credentials
2. [ ] Find your OAuth 2.0 Client ID
3. [ ] Add to **Authorized redirect URIs:**
   ```
   https://your-app.vercel.app/api/auth/callback/google
   ```

---

### **8. Test Production** ⏱️ 5 minutes

#### **Test Health Endpoint:**
```bash
curl https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "features": { "pdfExport": true }
}
```

#### **Test Scan:**
1. [ ] Visit `https://your-app.vercel.app`
2. [ ] Enter test URL: `https://example.com`
3. [ ] Click "Scan"
4. [ ] Wait for completion
5. [ ] Verify findings appear
6. [ ] Test PDF download (if enabled)
7. [ ] Test OAuth login (if enabled)

---

## 🎉 Post-Deployment

### **Optional: Add Custom Domain**
- [ ] Go to Vercel Project Settings
- [ ] Click **Domains**
- [ ] Add your custom domain
- [ ] Update DNS records

### **Optional: Enable Monitoring**
- [ ] Verify Sentry is receiving errors
- [ ] Set up uptime monitoring
- [ ] Configure alerts

### **Optional: Performance**
- [ ] Enable Vercel Analytics
- [ ] Check Lighthouse score
- [ ] Optimize images

---

## 📊 Summary

**Total Time:** ~30 minutes

**What You'll Have:**
- ✅ VibeSafe deployed to Vercel
- ✅ PostgreSQL database (Vercel Postgres or Neon)
- ✅ HTTPS enabled automatically
- ✅ Continuous deployment from GitHub
- ✅ Production-ready security scanner

---

## 🐛 Common Issues

### **Build Fails:**
- Check build logs in Vercel dashboard
- Verify `postinstall` script runs `prisma generate`
- Check all dependencies are in `package.json`

### **Database Connection Error:**
- Verify `DATABASE_URL` is set in Vercel environment variables
- Check database is publicly accessible
- Try adding `?connection_limit=1` to DATABASE_URL

### **Scan Timeout:**
- Vercel Hobby has 10s function limit
- Upgrade to Pro ($20/mo) for 300s timeout
- Or use external worker (Railway/Fly.io)

### **OAuth Not Working:**
- Verify callback URLs match exactly
- Check CLIENT_ID and CLIENT_SECRET are set
- Ensure `NEXTAUTH_URL` matches production URL

---

## 🎯 Ready to Deploy?

Start with **Step 2** (Push to GitHub) and work through the checklist!

**Current GitHub Repo:** https://github.com/RahulSunnyCS/sentryfront

Good luck! 🚀
