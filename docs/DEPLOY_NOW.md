# Deploy to Vercel - Quick Guide

**Status:** ✅ All fixes applied, ready to deploy!  
**Date:** 2026-05-11

---

## ✅ What Was Fixed

**Issue:** Vercel 500 error - `Error code 14: Unable to open the database file`  
**Root Cause:** Prisma client generated with SQLite config instead of PostgreSQL  
**Fix:** Smart environment detection + correct `postinstall` order

---

## 🚀 Deploy Steps

### **Option 1: Git Push (Auto-Deploy)**

```bash
# Commit the fixes
git add -A
git commit -m "fix: Configure database before Prisma generation in production

- Move db-config.js to postinstall hook (before prisma generate)
- Add VERCEL_ENV detection for automatic production mode
- Add graceful error handling with helpful messages
- Fix Error code 14: Unable to open database file

Closes issue: Vercel 500 error on /api/v1/scans"

# Push to trigger auto-deploy
git push
```

**Vercel will automatically:**
1. Run `npm install`
2. Run `postinstall` → Detect `VERCEL_ENV=production` → Configure for PostgreSQL → Generate Prisma client
3. Run `build` → Build Next.js app
4. Deploy! 🎉

---

### **Option 2: Manual Redeploy in Vercel**

If you've already pushed:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click **"Deployments"** tab
4. Find the latest deployment
5. Click **"⋯"** (three dots)
6. Click **"Redeploy"**
7. ✅ Should succeed now!

---

## 🔍 Verify Before Deploying

**Make sure these files have the fixes:**

### **1. package.json**
```json
{
  "scripts": {
    "postinstall": "node scripts/db-config.js && prisma generate",
    "build": "next build"
  }
}
```

**Key:** `db-config.js` runs in `postinstall` (before `prisma generate`), NOT in `build`

### **2. scripts/db-config.js**
Should have:
```javascript
const vercelEnv = process.env.VERCEL_ENV; // Detects Vercel
// ... smart environment detection logic
```

**Check:**
```bash
VERCEL_ENV=production DATABASE_URL="postgresql://test" node scripts/db-config.js
```

Should output: `🔧 Configuring database for: PRODUCTION`

---

## 📋 Vercel Environment Variables

**Make sure these are set in Vercel:**

### **Required:**
- ✅ `DATABASE_URL` — PostgreSQL connection string
- ✅ `NEXTAUTH_URL` — `https://vibesafe.codifie.dev`
- ✅ `NEXTAUTH_SECRET` — Random 32-char string
- ✅ `PAGESPEED_API_KEY` — Google API key

**To check:**
1. Vercel → Your Project → **Settings** → **Environment Variables**
2. Verify all 4 required variables are set
3. Make sure they're enabled for **Production** environment

**To add missing variables:**
1. Click "**Add New**"
2. Enter key and value
3. Check ✅ **Production**, ✅ Preview, ✅ Development
4. Click "**Save**"

---

## 🧪 Verify After Deploy

### **1. Check Deployment Logs**

**Look for these in Vercel build logs:**

```
Running "npm install"...
...
> vibesafe@0.1.0 postinstall
> node scripts/db-config.js && prisma generate

🔧 Configuring database for: PRODUCTION
   Detected Vercel environment: production
✅ Configured for PostgreSQL (DATABASE_URL)
✅ Configuration complete!

Environment variables loaded from .env.production
Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client to ./node_modules/@prisma/client
```

**✅ If you see this, Prisma was configured correctly!**

### **2. Check Health Endpoint**

```bash
curl https://vibesafe.codifie.dev/api/health
```

**Expected:**
```json
{
  "status": "ok",
  "db": {
    "type": "postgres",
    "status": "ok"
  },
  "env": {
    "status": "ok"
  }
}
```

### **3. Test Scan Creation**

```bash
curl -X POST https://vibesafe.codifie.dev/api/v1/scans \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

**Expected (201 Created):**
```json
{
  "id": "clx...",
  "status": "QUEUED",
  "targetUrl": "https://example.com"
}
```

---

## ❌ If Deployment Still Fails

### **Check Build Logs for:**

**Error 1: Missing DATABASE_URL**
```
❌ ERROR: Production mode requires DATABASE_URL environment variable
```
**Fix:** Add `DATABASE_URL` in Vercel → Settings → Environment Variables

**Error 2: Unable to open database file**
```
Error code 14: Unable to open the database file
```
**Fix:** This means Prisma is still using SQLite. Check:
- Is `postinstall` hook in package.json?
- Did you redeploy after committing changes?

**Error 3: Database connection failed**
```
PrismaClientInitializationError: Can't reach database server
```
**Fix:** Check that `DATABASE_URL` is a valid PostgreSQL connection string

---

## 📞 Need Help?

**If it's still failing:**

1. Share the Vercel build logs (especially the `postinstall` section)
2. Share the error from `/api/health` endpoint
3. Verify environment variables are set correctly

**Quick checks:**
```bash
# Check if changes are in package.json
cat package.json | grep postinstall

# Expected: "postinstall": "node scripts/db-config.js && prisma generate"
```

---

## ✅ Success Indicators

**You'll know it worked when:**

1. ✅ Vercel build logs show `Configured for PostgreSQL`
2. ✅ `/api/health` returns `"status": "ok"`
3. ✅ Scan creation returns `{"id": "...", "status": "QUEUED"}`
4. ✅ No more "Unable to open database file" errors

---

**Ready to deploy? Push your changes and let Vercel do the rest!** 🚀
