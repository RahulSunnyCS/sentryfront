# Vercel 500 Error - Quick Fix Guide

**Your URL:** https://vibesafe.codifie.dev  
**Error:** `POST /api/v1/scans` returns 500  
**Date:** 2026-05-11

---

## 🚨 Immediate Action

### **Step 1: Check Health Endpoint**

Visit: **https://vibesafe.codifie.dev/api/health**

This will show you exactly what's missing.

**Expected response if healthy:**
```json
{
  "status": "ok",
  "db": { "status": "ok" },
  "env": { "status": "ok" }
}
```

**If you see errors, proceed to Step 2.**

---

### **Step 2: Most Likely Causes**

Based on your error, here are the **top 3 most common issues**:

#### **🔴 Issue 1: DATABASE_URL Not Set** (90% probability)

**Check:**
```bash
# Visit https://vibesafe.codifie.dev/api/health
# Look for: "env": { "status": "error", "missing": ["DATABASE_URL"] }
```

**Fix:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select project: `vibesafe`
3. Settings → Environment Variables
4. Click "Add New"
   - **Key:** `DATABASE_URL`
   - **Value:** Your PostgreSQL connection string
   - **Environments:** ✅ Production, ✅ Preview, ✅ Development
5. Click "Save"
6. Go to Deployments → Latest → Click "⋯" → **Redeploy**

**Get DATABASE_URL from:**

**Option A: Vercel Postgres** (if you set it up)
1. Vercel → Storage → Select your database
2. Click ".env.local" tab
3. Copy the `POSTGRES_PRISMA_URL` value
4. Use that as `DATABASE_URL`

**Option B: Neon**
1. Go to [console.neon.tech](https://console.neon.tech)
2. Select your database
3. Connection Details → Connection string
4. Copy and use as `DATABASE_URL`

**Option C: Don't have a database yet?**
1. Vercel → Storage → Create Database → Postgres
2. Name: `vibesafe-db`
3. Region: us-east-1 (or closest)
4. Create
5. Connect to your project
6. It will auto-add `DATABASE_URL` to environment variables
7. Redeploy

---

#### **🔴 Issue 2: NEXTAUTH_SECRET Not Set** (5% probability)

**Fix:**
```bash
# Generate a secret
openssl rand -base64 32
```

Then add to Vercel:
1. Settings → Environment Variables
2. Add:
   - **Key:** `NEXTAUTH_SECRET`
   - **Value:** (paste the generated secret)
   - **Environments:** ✅ All
3. Add:
   - **Key:** `NEXTAUTH_URL`
   - **Value:** `https://vibesafe.codifie.dev`
   - **Environments:** ✅ Production
4. Save and redeploy

---

#### **🔴 Issue 3: Prisma Schema Not Pushed** (5% probability)

**Symptom:** Database connects but error mentions "Table does not exist"

**Fix:**
```bash
# Using Vercel CLI
vercel env pull .env.production
NODE_ENV=production npx prisma db push
```

Or add to your build command in Vercel:
1. Settings → General → Build & Development Settings
2. Build Command: `npm run build`
3. Make sure `package.json` has:
   ```json
   {
     "scripts": {
       "build": "node scripts/db-config.js && next build"
     }
   }
   ```

---

### **Step 3: View Error Logs**

1. Vercel → Functions tab
2. Click on the failed `/api/v1/scans` request
3. Read the error message
4. Share it if you need more help

---

## ✅ Quick Checklist

Run through this checklist:

- [ ] **DATABASE_URL** is set in Vercel environment variables
- [ ] **NEXTAUTH_URL** is set to `https://vibesafe.codifie.dev`
- [ ] **NEXTAUTH_SECRET** is set (random 32-char string)
- [ ] **PAGESPEED_API_KEY** is set (get from Google Cloud Console)
- [ ] Redeployed after adding environment variables
- [ ] Health endpoint (`/api/health`) shows `status: "ok"`
- [ ] Database is PostgreSQL (not SQLite for production)

---

## 🧪 Test After Fixing

### **1. Check Health:**
```bash
curl https://vibesafe.codifie.dev/api/health
```

Should return: `{"status":"ok", ...}`

### **2. Test Scan Creation:**
```bash
curl -X POST https://vibesafe.codifie.dev/api/v1/scans \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

Should return: `{"id":"...", "status":"QUEUED", ...}`

---

## 📞 Still Not Working?

**Share these with me:**

1. **Health endpoint response:**
   ```bash
   curl https://vibesafe.codifie.dev/api/health | jq
   ```

2. **Error from Vercel logs:**
   - Vercel → Functions → Click failed request → Copy error

3. **Environment variables set:**
   ```bash
   vercel env ls
   ```

**I'll help debug from there!**

---

## 🎯 Most Common Solution

**90% of the time, it's just missing `DATABASE_URL`:**

1. Vercel → Storage → Create Postgres DB
2. Connect to project
3. Redeploy
4. Done! ✅

**Takes 2 minutes.**
