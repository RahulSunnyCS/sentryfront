# 🚀 Deploy VibeSafe to Vercel

Complete guide to deploy VibeSafe to production on Vercel.

---

## 📋 Prerequisites

Before deploying, you need:

1. **Vercel Account** - Sign up at https://vercel.com
2. **GitHub Account** - Your code should be pushed to GitHub
3. **PostgreSQL Database** - For production (recommended: Vercel Postgres or Neon)
4. **Anthropic API Key** - For LLM enrichment (optional)

---

## 🎯 Deployment Steps

### **Step 1: Install Vercel CLI** (Optional)

```bash
npm i -g vercel
```

---

### **Step 2: Push Code to GitHub**

```bash
# If not already done
git add .
git commit -m "Ready for deployment"
git push origin main
```

---

### **Step 3: Create Vercel Project**

#### **Option A: Via Vercel Dashboard (Recommended)**

1. Go to https://vercel.com/new
2. **Import Git Repository**
3. Select your GitHub repository
4. Configure project:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./`
   - **Build Command:** `prisma generate && next build`
   - **Output Directory:** `.next`

#### **Option B: Via CLI**

```bash
vercel
# Follow the prompts
```

---

### **Step 4: Setup PostgreSQL Database**

#### **Option A: Vercel Postgres (Recommended)**

1. In your Vercel project dashboard
2. Go to **Storage** tab
3. Click **Create Database**
4. Select **Postgres**
5. Choose a region close to your users
6. Click **Create**

Vercel will automatically add `DATABASE_URL` to your environment variables.

#### **Option B: Neon (Free Alternative)**

1. Go to https://neon.tech
2. Create a free account
3. Create a new project
4. Copy the connection string
5. Add to Vercel environment variables as `DATABASE_URL`

---

### **Step 5: Configure Environment Variables**

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add the following:

#### **Required Variables:**

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://...` | From Vercel Postgres or Neon |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | Your production URL |
| `NEXTAUTH_SECRET` | Random string | Generate: `openssl rand -base64 32` |

#### **OAuth (if using Auth):**

| Variable | Value |
|----------|-------|
| `GITHUB_CLIENT_ID` | From GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | From GitHub OAuth App |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |

#### **Optional Features:**

| Variable | Value | Notes |
|----------|-------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | For AI enrichment |
| `LLM_ENRICHMENT_ENABLED` | `true` | Enable LLM |
| `PDF_EXPORT_ENABLED` | `true` | Enable PDF |
| `SENTRY_DSN` | Your Sentry DSN | Error monitoring |

---

### **Step 6: Run Database Migrations**

After deployment, you need to run Prisma migrations:

#### **Option A: Vercel CLI**

```bash
# Set production database URL locally (temporarily)
export DATABASE_URL="postgresql://your-production-db-url"

# Run migrations
npx prisma migrate deploy

# Or use Prisma Studio to verify
npx prisma studio
```

#### **Option B: One-Time Deploy Script**

Create `scripts/migrate-production.sh`:

```bash
#!/bin/bash
npx prisma migrate deploy
```

Then run it once after first deployment.

---

### **Step 7: Configure OAuth Redirects**

If using authentication:

#### **GitHub OAuth:**
1. Go to https://github.com/settings/developers
2. Update your OAuth App
3. **Authorization callback URL:** `https://your-app.vercel.app/api/auth/callback/github`

#### **Google OAuth:**
1. Go to https://console.cloud.google.com
2. Update your OAuth credentials
3. **Authorized redirect URIs:** `https://your-app.vercel.app/api/auth/callback/google`

---

## ✅ Verify Deployment

### **1. Check Build Logs**

In Vercel dashboard:
- Go to **Deployments**
- Click on latest deployment
- Check build logs for errors

### **2. Test Health Endpoint**

```bash
curl https://your-app.vercel.app/api/health
```

Should return:
```json
{
  "status": "ok",
  "features": {
    "pdfExport": true,
    "auth": true
  }
}
```

### **3. Run a Test Scan**

1. Visit `https://your-app.vercel.app`
2. Enter a URL
3. Click "Scan"
4. Verify scan completes

---

## 🔧 Production Considerations

### **Database:**
- ✅ Use PostgreSQL (not SQLite) for production
- ✅ Enable connection pooling with Prisma Data Proxy or PgBouncer
- ✅ Set `DATABASE_URL` with `?connection_limit=1&pool_timeout=10`

### **Scan Worker:**
- ⚠️ Vercel has 10-second function timeout on Hobby plan
- ✅ For long scans, consider:
  - Upgrading to Pro plan (300s timeout)
  - Or using external worker (Railway/Fly.io)

### **Costs:**
- Vercel Hobby: Free (limited functions)
- Vercel Pro: $20/month (recommended for production)
- PostgreSQL: ~$5-20/month
- LLM: ~$0.001/scan

---

## 🐛 Troubleshooting

### **Build Fails:**
```bash
# Check if Prisma is generating properly
vercel logs
```

Add to `package.json`:
```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

### **Database Connection Fails:**
- Verify `DATABASE_URL` is set in Vercel environment variables
- Check database is publicly accessible
- Try connection pooling: add `?connection_limit=1` to URL

### **Scan Timeout:**
- Upgrade to Vercel Pro for 300s function timeout
- Or move scan worker to separate service (Railway)

---

## 🚀 You're Live!

Your VibeSafe instance should now be live at:
**https://your-app.vercel.app**

Test it by running a security scan! 🎉

---

## 📚 Next Steps

- Configure custom domain
- Set up monitoring (Sentry)
- Enable LLM enrichment
- Configure email notifications
- Add API rate limiting
