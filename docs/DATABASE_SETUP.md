# Database Setup Guide

VibeSafe automatically switches between **SQLite** (development) and **PostgreSQL** (production) based on the `NODE_ENV` environment variable.

---

## Quick Start

### Local Development (SQLite)

**No setup required!** Just run:

```bash
npm run db:migrate
```

This will:
1. Configure Prisma for SQLite
2. Create `vibesafe.db` in your project root
3. Run all migrations

### Production (PostgreSQL)

Set your production database URL in `.env`:

```bash
NODE_ENV="production"
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
```

Then deploy:

```bash
npm run db:deploy
```

---

## How It Works

### Automatic Database Switching

The `scripts/db-config.js` script automatically configures Prisma based on `NODE_ENV`:

| NODE_ENV | Provider | URL Variable | Database |
|----------|----------|--------------|----------|
| `development` | `sqlite` | `DEV_DATABASE_URL` | `vibesafe.db` |
| `production` | `postgresql` | `DATABASE_URL` | PostgreSQL |

### NPM Scripts

All database commands automatically configure the correct provider:

```bash
# Development (SQLite)
npm run dev              # Auto-configures for SQLite, starts dev server
npm run db:migrate       # Run migrations on SQLite
npm run db:reset         # Reset SQLite database
npm run db:studio        # Open Prisma Studio

# Production (PostgreSQL)
npm run db:config:prod   # Manually switch to PostgreSQL
npm run db:deploy        # Deploy migrations to PostgreSQL
NODE_ENV=production npm run build  # Build for production
```

---

## Environment Variables

### `.env` Configuration

```bash
# Environment (controls database selection)
NODE_ENV="development"  # or "production"

# Development Database (SQLite)
DEV_DATABASE_URL="file:./vibesafe.db"

# Production Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@host:5432/db?sslmode=require"
```

### Vercel/Production Deployment

In your Vercel/production environment variables:

```bash
NODE_ENV="production"
DATABASE_URL="your-postgres-connection-string"
```

The build process will automatically use PostgreSQL.

---

## Manual Configuration

If you need to manually switch database providers:

```bash
# Switch to development (SQLite)
node scripts/db-config.js development
npx prisma generate

# Switch to production (PostgreSQL)
node scripts/db-config.js production
npx prisma generate
```

---

## Migration Workflow

### Creating New Migrations

**Local Development:**

```bash
# 1. Make changes to prisma/schema.prisma
# 2. Generate migration
npm run db:migrate

# 3. Name your migration when prompted
# 4. Commit both schema.prisma and the new migration file
```

### Deploying to Production

**Option 1: Automatic (Recommended)**

Set `NODE_ENV=production` in your deployment platform. The build script will automatically:
1. Configure Prisma for PostgreSQL
2. Generate the client
3. Run migrations on build

**Option 2: Manual**

```bash
NODE_ENV=production npm run db:deploy
```

---

## Database Providers

### SQLite (Development)

**Advantages:**
- ✅ Zero setup
- ✅ Fast local development
- ✅ No external dependencies
- ✅ Easy to reset/test

**Limitations:**
- ❌ Not suitable for production
- ❌ Limited concurrent connections
- ❌ No advanced PostgreSQL features

### PostgreSQL (Production)

**Advantages:**
- ✅ Production-ready
- ✅ Full SQL features
- ✅ Concurrent connections
- ✅ Better performance at scale

**Recommended Providers:**
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) (easiest Vercel integration)
- [Neon](https://neon.tech/) (serverless PostgreSQL)
- [Supabase](https://supabase.com/) (PostgreSQL + additional features)
- [Railway](https://railway.app/) (simple PostgreSQL hosting)

---

## Troubleshooting

### Error: "Provider mismatch in migration_lock.toml"

This happens when switching between SQLite and PostgreSQL.

**Solution:**

```bash
# Remove old migrations (only if starting fresh!)
rm -rf prisma/migrations

# Re-run migrations
npm run db:migrate
```

**⚠️ Warning:** Only do this in development! In production, use `db:deploy`.

### Prisma Client Out of Sync

After switching providers, regenerate the client:

```bash
npx prisma generate
```

### Reset Development Database

```bash
npm run db:reset
```

This will:
1. Drop the SQLite database
2. Re-create it
3. Run all migrations
4. Seed data (if configured)

---

## Best Practices

1. **Always use SQLite for local development** - Fast and easy
2. **Use PostgreSQL for staging/production** - Production-ready
3. **Commit migrations to git** - Keep schema changes tracked
4. **Test migrations locally first** - Before deploying to production
5. **Use `db:deploy` in CI/CD** - For production deployments

---

## Questions?

See also:
- `docs/ENV_MIGRATION_GUIDE.md` - Environment variable setup
- `docs/REFACTORING_SUMMARY.md` - Recent configuration changes
- [Prisma Docs](https://www.prisma.io/docs/) - Official documentation
