# Vercel Postgres Setup Guide

## Overview

Vercel Postgres is a serverless Postgres database service that integrates seamlessly with Vercel deployments. The free tier includes:
- ✅ 256 MB storage
- ✅ 60 hours of compute per month
- ✅ Automatic SSL/TLS
- ✅ Connection pooling included

## Setup Steps

### 1. Create Vercel Postgres Database

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to "Storage" tab
3. Click "Create Database"
4. Select "Postgres"
5. Name your database (e.g., `vibesafe-db`)
6. Select region (choose closest to your users)
7. Click "Create"

### 2. Connect to Your Project

1. After database creation, click "Connect Project"
2. Select your `sentryfront` project
3. Choose environments:
   - ✅ Production
   - ✅ Preview
   - ✅ Development (optional)
4. Click "Connect"

Vercel will automatically add these environment variables:
```
POSTGRES_URL
POSTGRES_PRISMA_URL
POSTGRES_URL_NON_POOLING
POSTGRES_USER
POSTGRES_HOST
POSTGRES_PASSWORD
POSTGRES_DATABASE
```

### 3. Local Development Setup

#### Option A: Pull Environment Variables from Vercel

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Link your project
vercel link

# Pull environment variables
vercel env pull .env.local
```

This will create `.env.local` with all your Vercel environment variables!

#### Option B: Manual Setup

1. Go to Vercel Dashboard → Storage → Your Postgres Database
2. Click ".env.local" tab
3. Copy the environment variables
4. Create `.env.local` in your project root:

```bash
# .env.local (created automatically by `vercel env pull`)
POSTGRES_URL="postgres://..."
POSTGRES_PRISMA_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."
```

5. Update your `.env` to use Vercel Postgres:

```bash
# Use Vercel Postgres (pooled connection for Prisma)
DATABASE_URL="${POSTGRES_PRISMA_URL}"
```

### 4. Run Database Migrations

```bash
# Generate Prisma Client
npx prisma generate

# Push schema to database (for development)
npx prisma db push

# Or run migrations (for production)
npx prisma migrate deploy
```

### 5. Verify Connection

```bash
# Test database connection
npx prisma studio
```

This should open Prisma Studio at http://localhost:5555 showing your database!

---

## Deployment

### Automatic Deployment

When you push to your repository, Vercel will:
1. ✅ Automatically run migrations (if configured in build command)
2. ✅ Use the connected Postgres database
3. ✅ Deploy your application

### Build Configuration

Update your `package.json` to run migrations on deploy:

```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build",
    "postinstall": "prisma generate"
  }
}
```

Or configure in Vercel dashboard:
- **Build Command**: `npm run build`
- **Install Command**: `npm install && npx prisma generate`

---

## Environment Variables

### Required for Production

Make sure these are set in Vercel:
- ✅ `POSTGRES_PRISMA_URL` (automatically added by Vercel)
- ✅ `DATABASE_URL` → Set to `${POSTGRES_PRISMA_URL}`

### Optional (Application-Specific)

Add these in Vercel → Settings → Environment Variables:
```
PAGESPEED_API_KEY=your_google_api_key
ANTHROPIC_API_KEY=your_claude_api_key
PERFORMANCE_SCANNING_ENABLED=true
ACCESSIBILITY_SCANNING_ENABLED=true
SEO_SCANNING_ENABLED=true
```

---

## Troubleshooting

### Connection Error: "Can't reach database server"

**Solution**: Make sure you're using `POSTGRES_PRISMA_URL` (pooled connection) not `POSTGRES_URL`:

```bash
# .env.local
DATABASE_URL="${POSTGRES_PRISMA_URL}"
```

### Migration Errors on Deploy

**Solution**: Use `prisma migrate deploy` instead of `prisma migrate dev` in production:

```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

### "Prepared statement already exists"

**Solution**: Enable connection pooling in Prisma schema:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("POSTGRES_URL_NON_POOLING")
}
```

---

## Free Tier Limits

**Vercel Postgres Free Tier:**
- Storage: 256 MB
- Compute: 60 hours/month
- Rows: ~500,000 (estimated)

**Tips to Stay Within Limits:**
- Archive old scans periodically
- Implement data retention policy
- Monitor usage in Vercel dashboard

---

## Migration from SQLite

If you're migrating from SQLite to Postgres:

1. Export SQLite data (optional):
```bash
npx prisma db pull --schema=prisma/schema.sqlite.prisma
```

2. Update DATABASE_URL to Postgres

3. Run migrations:
```bash
npx prisma migrate deploy
```

4. Import data (if needed - manual process)

---

## Next Steps

After setup:
1. ✅ Verify connection: `npx prisma studio`
2. ✅ Run migrations: `npx prisma migrate deploy`
3. ✅ Deploy to Vercel: `git push`
4. ✅ Test production: Visit your Vercel URL

**Need help?** Check Vercel docs: https://vercel.com/docs/storage/vercel-postgres
