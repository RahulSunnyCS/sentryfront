# Database Configuration Improvements

**Date:** 2026-05-11  
**Issue:** Vercel 500 error due to missing `DEV_DATABASE_URL` in production  
**Fix:** Smart environment detection and graceful fallback

---

## 🎯 What Was Fixed

### **Problem:**
The original `scripts/db-config.js` would:
1. Default to development mode unless `NODE_ENV=production` was explicitly set
2. Try to use `DEV_DATABASE_URL` in production if `NODE_ENV` wasn't set
3. Fail silently, causing Prisma to error at runtime

### **Solution:**
Enhanced `scripts/db-config.js` with smart environment detection:

1. **Auto-detects production** via multiple signals:
   - `VERCEL_ENV` environment variable (set automatically by Vercel)
   - `NODE_ENV=production`
   - Presence of `DATABASE_URL` without `DEV_DATABASE_URL`

2. **Graceful error handling:**
   - Exits with clear error if production mode but no `DATABASE_URL`
   - Warns but continues if development mode without `DEV_DATABASE_URL`
   - Shows helpful instructions for getting a database

3. **Better logging:**
   - Shows which environment was detected
   - Explains what configuration was applied
   - Provides next steps

---

## ✅ How It Works Now

### **Production Detection (Priority Order):**

1. **Explicit argument:** `node scripts/db-config.js production` → Always use PostgreSQL
2. **VERCEL_ENV:** If set to `production` → Use PostgreSQL
3. **NODE_ENV:** If set to `production` → Use PostgreSQL
4. **Smart fallback:** If only `DATABASE_URL` is set (no `DEV_DATABASE_URL`) → Use PostgreSQL
5. **Default:** Development mode → Use SQLite

### **Environment Variable Validation:**

**Production mode:**
- ✅ Requires `DATABASE_URL` (fails with helpful error if missing)
- ✅ Configures Prisma for PostgreSQL
- ✅ Shows next steps for deployment

**Development mode:**
- ⚠️  Warns if `DEV_DATABASE_URL` is missing (but continues)
- ✅ Uses fallback: `file:./vibesafe.db`
- ✅ Configures Prisma for SQLite

---

## 🧪 Testing the Fix

### **Test 1: Vercel Production (with DATABASE_URL)**
```bash
VERCEL_ENV=production DATABASE_URL="postgresql://..." node scripts/db-config.js
```
**Expected:**
```
🔧 Configuring database for: PRODUCTION
   Detected Vercel environment: production
✅ Configured for PostgreSQL (DATABASE_URL)
✅ Configuration complete!
```

### **Test 2: Vercel Production (missing DATABASE_URL)**
```bash
VERCEL_ENV=production node scripts/db-config.js
```
**Expected:**
```
🔧 Configuring database for: PRODUCTION
   Detected Vercel environment: production
❌ ERROR: Production mode requires DATABASE_URL environment variable

Please set DATABASE_URL to your PostgreSQL connection string:
  - Vercel: Settings → Environment Variables → Add DATABASE_URL
  - Local: Add DATABASE_URL=postgresql://... to .env

💡 Get a free PostgreSQL database:
  - Vercel Postgres: vercel.com/storage
  - Neon: neon.tech
  - Supabase: supabase.com

[exits with code 1]
```

### **Test 3: Local Development**
```bash
NODE_ENV=development DEV_DATABASE_URL="file:./dev.db" node scripts/db-config.js
```
**Expected:**
```
🔧 Configuring database for: DEVELOPMENT
✅ Configured for SQLite (DEV_DATABASE_URL)
✅ Configuration complete!
```

### **Test 4: Local Development (missing DEV_DATABASE_URL)**
```bash
NODE_ENV=development node scripts/db-config.js
```
**Expected:**
```
🔧 Configuring database for: DEVELOPMENT
⚠️  WARNING: Development mode requires DEV_DATABASE_URL
   Using fallback: file:./vibesafe.db
   Add DEV_DATABASE_URL="file:./vibesafe.db" to .env to silence this warning
✅ Configured for SQLite (DEV_DATABASE_URL)
✅ Configuration complete!
```

---

## 📦 Integration with Vercel

### **How Vercel Uses This:**

**During Build (automatic):**
1. Vercel sets `VERCEL_ENV=production` automatically
2. `npm run build` calls `node scripts/db-config.js`
3. Script detects Vercel production environment
4. Configures Prisma for PostgreSQL with `DATABASE_URL`
5. Fails fast if `DATABASE_URL` is not set

**Build Script:**
```json
{
  "scripts": {
    "build": "node scripts/db-config.js && next build"
  }
}
```

### **Required Vercel Environment Variables:**

**Production:**
- ✅ `DATABASE_URL` — PostgreSQL connection string (REQUIRED)
- ✅ `NEXTAUTH_URL` — Your domain
- ✅ `NEXTAUTH_SECRET` — Random secret
- ✅ `PAGESPEED_API_KEY` — Google API key

**Note:** `VERCEL_ENV` is set automatically by Vercel, no need to add it manually.

---

## 🚀 Benefits

1. **No more 500 errors** due to missing `DEV_DATABASE_URL` in production
2. **Graceful failure** with helpful error messages
3. **Smart detection** works across Vercel, local, and other platforms
4. **Clear logging** shows exactly what's happening
5. **Fail-fast** in production if database is misconfigured
6. **Developer-friendly** warnings in development mode

---

## 📋 Migration Guide

**If you're already deployed and hitting this issue:**

1. **Add DATABASE_URL to Vercel:**
   - Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add `DATABASE_URL` with your PostgreSQL connection string
   - Select all environments (Production, Preview, Development)

2. **Redeploy:**
   - Deployments → Latest → ⋯ → Redeploy
   - Build should succeed now

3. **Verify:**
   - Visit `/api/health` → Should show `status: "ok"`
   - Try creating a scan → Should work!

**No code changes needed** — the fix is already in `scripts/db-config.js`!

---

## 🔍 Behind the Scenes

### **What Changed in `scripts/db-config.js`:**

**Before:**
```javascript
const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';
// Always used DEV_DATABASE_URL if NODE_ENV wasn't set
```

**After:**
```javascript
// Smart detection
const vercelEnv = process.env.VERCEL_ENV; // ← NEW
const hasDatabaseUrl = !!process.env.DATABASE_URL; // ← NEW

let isProduction;
if (vercelEnv === 'production') {
  isProduction = true;  // ← Detects Vercel automatically
} else if (hasDatabaseUrl && !hasDevDatabaseUrl) {
  isProduction = true;  // ← Smart fallback
} else {
  isProduction = false;
}

// Validation
if (isProduction && !hasDatabaseUrl) {
  console.error('❌ ERROR: Production mode requires DATABASE_URL');
  process.exit(1);  // ← Fail fast instead of silent failure
}
```

---

## ✅ Status

- ✅ Fixed smart environment detection
- ✅ Added graceful error handling
- ✅ Improved logging and debugging
- ✅ Tested in production and development modes
- ✅ Updated documentation
- ✅ Ready for Vercel deployment

**Your production deployment should now work without errors!**
