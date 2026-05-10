# 🚀 VibeSafe Vercel Deployment - Step by Step

Follow these steps to deploy VibeSafe to Vercel RIGHT NOW!

---

## ✅ Prerequisites Checklist

- [x] Code is pushed to GitHub: `https://github.com/RahulSunnyCS/sentryfront`
- [x] Branch: `phase-complete`
- [x] All features working locally
- [ ] Vercel account (create now if needed)
- [ ] Environment variables ready (see below)

---

## 🎯 Step-by-Step Deployment

### **Step 1: Import Project to Vercel** ⏱️ 2 minutes

The browser should be open at: **https://vercel.com/new**

1. **Sign in / Sign up** to Vercel
   - Use your GitHub account (easiest)
   - Authorize Vercel to access your repositories

2. **Import Git Repository**
   - Click **"Import Git Repository"**
   - Find: `RahulSunnyCS/sentryfront`
   - Click **"Import"**

3. **Configure Project**
   - **Project Name:** `vibesafe` (or your choice)
   - **Framework Preset:** Next.js ✅ (auto-detected)
   - **Root Directory:** `./`
   - **Build Command:** Leave default (or `prisma generate && next build`)
   - **Output Directory:** `.next`

**⚠️ DON'T CLICK DEPLOY YET!** We need to add environment variables first.

---

### **Step 2: Add Environment Variables** ⏱️ 5 minutes

Scroll down to **"Environment Variables"** section.

#### **Required Variables:**

```env
# 1. Generate NEXTAUTH_SECRET (run this in terminal)
#    openssl rand -base64 32
NEXTAUTH_SECRET=<paste-generated-secret-here>

# 2. Database - Will be added by Vercel Postgres (see Step 3)
#    DATABASE_URL=<will-be-added-automatically>

# 3. NextAuth URL - Use your Vercel preview URL
#    Format: https://vibesafe.vercel.app (or your custom domain)
NEXTAUTH_URL=https://vibesafe.vercel.app
```

#### **Optional - LLM Enrichment (Recommended):**

```env
# Get this from https://console.anthropic.com
ANTHROPIC_API_KEY=<your-anthropic-api-key-here>

LLM_ENRICHMENT_ENABLED=true
ANTHROPIC_MODEL=claude-sonnet-4-20250514
LLM_ENRICHMENT_TIMEOUT_MS=20000
```

#### **Optional - OAuth (If you want GitHub/Google login):**

```env
GITHUB_CLIENT_ID=<your-github-oauth-client-id>
GITHUB_CLIENT_SECRET=<your-github-oauth-client-secret>
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>
```

#### **Optional - Features:**

```env
PDF_EXPORT_ENABLED=true
NEXT_PUBLIC_PDF_EXPORT_ENABLED=true
FEATURE_SCAN_DIFF_ENABLED=true
TIER_GATING_ENABLED=false
```

#### **Optional - Monitoring:**

```env
SENTRY_DSN=<your-sentry-dsn-if-you-have-one>
```

---

### **Step 3: Add Vercel Postgres Database** ⏱️ 3 minutes

**IMPORTANT:** Do this BEFORE clicking Deploy!

1. In the Vercel import screen, look for **"Storage"** section
2. Or click **"Add Storage"** button
3. Select **"Postgres"**
4. Click **"Create"**
5. Choose region (closest to your users)
6. Vercel will automatically add `DATABASE_URL` environment variable

**Alternative:** Use Neon (free tier)
- Go to https://neon.tech
- Create free database
- Copy connection string
- Add as `DATABASE_URL` environment variable

---

### **Step 4: Deploy!** ⏱️ 3 minutes

1. **Click "Deploy"** button
2. **Wait** for build to complete (2-3 minutes)
3. **Watch the logs** - should see:
   ```
   ✓ Generating Prisma Client
   ✓ Building pages
   ✓ Compiling...
   ✓ Build completed
   ```

If successful, you'll see: **"Congratulations! Your project has been deployed"** 🎉

---

### **Step 5: Run Database Migrations** ⏱️ 2 minutes

After first deployment, run migrations locally:

```bash
# In your local terminal:

# 1. Get production DATABASE_URL from Vercel dashboard
#    Settings → Environment Variables → DATABASE_URL → Copy

# 2. Set it temporarily
export DATABASE_URL="postgresql://your-production-db-url-from-vercel"

# 3. Run migrations
npx prisma migrate deploy

# 4. Verify tables created
npx prisma studio
```

**Alternative:** Use Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Run migration in production
vercel env pull .env.production
npx prisma migrate deploy
```

---

### **Step 6: Test Your Deployment** ⏱️ 3 minutes

1. **Click "Visit"** button on Vercel success page
2. Your app will open at: `https://vibesafe.vercel.app`

**Test these:**

✅ **Home page loads**
- Should see VibeSafe landing page

✅ **Run a scan**
- Enter: `https://example.com`
- Click "Scan"
- Wait ~30 seconds
- Should see security report

✅ **Check health endpoint**
```bash
curl https://vibesafe.vercel.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "features": {
    "pdfExport": true,
    "auth": true
  }
}
```

✅ **Test PDF export** (if enabled)
- View a completed scan
- Click "Download PDF"
- Should download PDF file

✅ **Test LLM enrichment**
- Check findings have detailed AI explanations
- Look for "Explanation" and "Impact" sections

---

## 🎉 You're Live!

**Your VibeSafe is now deployed at:**
`https://vibesafe.vercel.app`

---

## 🔧 Post-Deployment Tasks

### **Configure Custom Domain** (Optional)

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXTAUTH_URL` environment variable to your custom domain

### **Update OAuth Callbacks** (If using GitHub/Google)

#### GitHub:
1. Go to https://github.com/settings/developers
2. Update OAuth App callback URL:
   ```
   https://vibesafe.vercel.app/api/auth/callback/github
   ```

#### Google:
1. Go to https://console.cloud.google.com
2. Update OAuth redirect URIs:
   ```
   https://vibesafe.vercel.app/api/auth/callback/google
   ```

---

## 🐛 Troubleshooting

### **Build Fails:**
- Check build logs in Vercel dashboard
- Verify all environment variables are set
- Check that `postinstall` script runs `prisma generate`

### **Database Connection Error:**
- Verify `DATABASE_URL` is set
- Check Vercel Postgres is created and connected
- Try re-deploying

### **Scan Timeout (10s limit):**
- Vercel Hobby plan has 10s timeout
- **Solution 1:** Upgrade to Vercel Pro ($20/mo) for 300s timeout
- **Solution 2:** Move scans to external worker (Railway/Fly.io)

### **Environment Variables Not Working:**
- Redeploy after adding variables
- Check variable names match exactly
- Make sure you're checking production deployment (not preview)

---

## 💡 Pro Tips

1. **Use Preview Deployments**
   - Every git push creates a preview URL
   - Test before merging to main

2. **Enable Vercel Analytics**
   - Free insights into performance
   - Settings → Analytics → Enable

3. **Set up Notifications**
   - Get alerts for failed deployments
   - Settings → Notifications

4. **Monitor Logs**
   - Real-time logs in Vercel dashboard
   - Helpful for debugging

---

## ✅ Deployment Complete!

**What you have now:**
- ✅ VibeSafe live on the internet
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Continuous deployment (auto-deploy on git push)
- ✅ PostgreSQL database
- ✅ LLM enrichment (if configured)
- ✅ PDF export (if configured)

**Total time:** ~15 minutes

**Monthly cost:** $0 (free tier) or $20 (Pro for longer timeouts)

---

**Need help?** Check the logs in Vercel dashboard or the troubleshooting section above!

🎉 **Congratulations on deploying VibeSafe!** 🎉
