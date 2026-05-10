# Local Setup Guide

## Prerequisites

- Node.js 18+ (`node --version`)
- npm 9+ (`npm --version`)
- Git

No external database, Redis, or cloud service is required to run locally.

---

## 1. Clone the repository

```bash
git clone https://github.com/RahulSunnyCS/sentryfront.git
cd sentryfront
```

## 2. Install dependencies

```bash
npm install
```

> `prisma generate` runs automatically via the `postinstall` hook — the Prisma client will be ready immediately after install.

## 3. Configure environment

Create a `.env` file in the project root. **This file is gitignored — every developer creates it locally.**

```bash
echo 'DATABASE_URL="file:./vibesafe.db"' > .env
```

**Why `.env` and not `.env.local`?**  
Next.js reads `.env.local`; the Prisma CLI reads `.env`. Both files are needed to serve different tools. For local dev, only `.env` matters for Prisma commands. If you add more env vars, put public ones (prefixed `NEXT_PUBLIC_`) in `.env.local` and keep the DB URL in `.env`.

## 4. Set up the database

```bash
npm run db:migrate
```

This applies all pending migrations and creates `vibesafe.db` (SQLite) at the project root. If prompted for a migration name, just press Enter.

## 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How it works locally

| Concern | Local behaviour |
|---|---|
| Database | SQLite at `./vibesafe.db` — created automatically by `npm run db:migrate` |
| Scan worker | Runs as a fire-and-forget Promise in the same Node.js process |
| SSE progress stream | Polls the `ScanEvent` table every 500ms |
| Redis | Not required — omit `REDIS_URL` and everything still works |

When you submit a URL on the landing page:
1. `POST /api/v1/scans` creates a scan record and starts the worker
2. The browser connects to `/api/v1/scans/[id]/stream` (SSE)
3. The worker simulates all 15 modules, publishing progress events to the DB
4. The scanning screen advances in real time as events arrive
5. On completion the browser navigates to `/report/[id]`

---

## Prisma

### What is Prisma?

Prisma is the ORM (Object-Relational Mapper) used by VibeSafe. It provides:

- **Schema-as-code** — your database structure is defined in `prisma/schema.prisma` and version-controlled
- **Auto-generated type-safe client** — all DB queries are fully typed with no manual SQL
- **Migration system** — schema changes produce SQL migration files that are applied in order, keeping every developer's DB in sync
- **Prisma Studio** — a visual browser for your database tables

### Schema overview

The schema lives in `prisma/schema.prisma` and defines five models:

| Model | Purpose |
|---|---|
| `User` | Account records — email, tier (free/pro/studio), Stripe customer ID |
| `Scan` | One per URL submission — status, grade, score, summary, timestamps |
| `Finding` | Individual vulnerabilities linked to a scan — severity, evidence, fix steps |
| `ScanEvent` | Lightweight progress events emitted by the worker; polled by the SSE endpoint when Redis is absent |
| `DomainVerification` | Domain ownership tokens for Phase 2 active scanning |

**Relations:**
- `User` → `Scan` (one-to-many, nullable — anonymous scans are allowed)
- `User` → `DomainVerification` (one-to-many, cascade delete)
- `Scan` → `Finding` (one-to-many, cascade delete)
- `Scan` → `ScanEvent` (one-to-many, cascade delete)

**Provider:**  
Currently `sqlite`. No installation or credentials needed. For production, change to `postgresql` (see [Switching to PostgreSQL](#switching-to-postgresql) below).

### How migrations work

A migration is a SQL file that records a schema change. The workflow is:

```
Edit schema.prisma  →  npm run db:migrate  →  SQL file written to prisma/migrations/  →  Applied to DB
```

1. **Edit** `prisma/schema.prisma` to add a model, field, or index
2. **Run** `npm run db:migrate` — Prisma diffs the current schema against the last migration, generates the required SQL, and applies it
3. **Commit** both `schema.prisma` and the new file in `prisma/migrations/` — this is how other developers get the change

When a teammate runs `git pull` and then `npm run db:migrate`, their DB catches up automatically.

> **Never** edit migration SQL files by hand after they have been applied. If a migration needs fixing, create a new one.

### npm scripts

```bash
npm run db:migrate   # Create and apply a new migration (interactive — asks for a name)
npm run db:studio    # Open Prisma Studio — visual table browser at http://localhost:5555
npm run db:reset     # ⚠ Destructive — wipe the DB and re-apply all migrations from scratch
```

#### `npm run db:migrate` in detail

Running `db:migrate` does three things in one command:
1. Compares `schema.prisma` to the last applied migration
2. Generates a timestamped SQL file under `prisma/migrations/<timestamp>_<name>/migration.sql`
3. Applies the SQL to the local database and runs `prisma generate` to update the client

Use it whenever you change the schema.

#### `npm run db:studio`

Opens a web-based table browser at `http://localhost:5555`. You can view rows, filter, sort, and edit records directly — useful for inspecting scan results during development.

```
┌─────────────┬──────────────────────────────┬──────────┬───────┐
│ id          │ targetUrl                    │ status   │ grade │
├─────────────┼──────────────────────────────┼──────────┼───────┤
│ clx1a2b3c…  │ https://taskflow.app         │ COMPLETE │ D     │
└─────────────┴──────────────────────────────┴──────────┴───────┘
```

#### `npm run db:reset`

Drops all tables, re-applies every migration from scratch, and re-runs `prisma generate`. Use this when:
- Your local DB is in a broken state
- You want to start fresh during schema experimentation
- You pulled a migration that conflicts with local changes

### `postinstall` hook

The `package.json` `postinstall` script runs `prisma generate` automatically after every `npm install`. This regenerates the Prisma client whenever:
- You clone the repo fresh
- A teammate changes the schema and you pull + install
- Vercel or another CI/CD platform installs dependencies before building

Without this hook, you would see runtime errors like `PrismaClient is not a constructor` after a fresh install.

### The Prisma client singleton

`src/lib/prisma.ts` exports a single shared `PrismaClient` instance:

```ts
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ['warn', 'error'] });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

In development, Next.js hot-reloads modules on every change. Without the global singleton, each reload would create a new `PrismaClient` and exhaust the SQLite connection limit. The global pattern prevents this.

Always import from `@/lib/prisma`, never call `new PrismaClient()` elsewhere.

### Migrations directory

```
prisma/migrations/
├── 20260510055012_initial_schema/
│   └── migration.sql          ← Creates all 5 tables
├── 20260510061502_add_domain_verification_relation/
│   └── migration.sql          ← Adds FK from DomainVerification to User
└── migration_lock.toml        ← Locks the provider (sqlite); do not edit
```

Every migration file is committed. If `migration_lock.toml` shows a different provider than your `schema.prisma`, Prisma will refuse to migrate — this prevents accidental provider switches.

### Switching to PostgreSQL

1. **Change the provider** in `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"   // was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

2. **Update your `.env`**:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/vibesafe"
   ```

3. **Re-run migrations**:
   ```bash
   npm run db:migrate
   ```
   Prisma will generate PostgreSQL-compatible SQL and apply it.

> Note: `migration_lock.toml` will need to be updated from `sqlite` to `postgresql`. Prisma will prompt you to confirm this irreversible change.

---

## Optional: connect Redis for background workers

Set `REDIS_URL` in `.env`:

```env
REDIS_URL="redis://localhost:6379"
```

When `REDIS_URL` is present:
- Scan jobs are published to a Redis queue (BullMQ)
- The SSE endpoint subscribes to a Redis pub/sub channel instead of polling the DB every 500ms

For local dev this is entirely optional. The polling fallback works fine.

---

## Useful scripts

```bash
npm run dev          # Start Next.js dev server (http://localhost:3000)
npm run build        # Production build
npm run typecheck    # TypeScript type check (no emit)
npm run lint         # ESLint
npm run format       # Prettier

npm run db:migrate   # Create and apply a DB migration
npm run db:studio    # Visual DB browser (http://localhost:5555)
npm run db:reset     # Wipe and re-apply all migrations (destructive)
```

---

## Project structure

```
sentryfront/
├── prisma/
│   ├── schema.prisma          # Database schema — edit this to change the DB structure
│   ├── migrations/            # SQL migration history — commit these
│   └── vibesafe.db            # SQLite database (gitignored — created locally)
├── src/
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── scan/[id]/         # Scanning progress screen
│   │   ├── report/[id]/       # Report dashboard
│   │   └── api/
│   │       ├── health/        # GET /api/health
│   │       └── v1/scans/      # Scan CRUD + SSE stream
│   ├── components/            # Shared UI components
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── api.ts             # Frontend API client
│   │   ├── url-validator.ts   # URL validation + IP blocking
│   │   ├── scan-worker.ts     # Scan worker stub (Phase 2)
│   │   ├── events.ts          # Redis / DB-poll event bus
│   │   ├── data.ts            # Fixture scan data + config constants
│   │   └── config.ts          # Runtime config helpers
│   └── types/
│       └── index.ts           # Shared TypeScript types
├── design/                    # Original UI prototype (reference only)
├── docs/                      # PRD and TDD documents
├── PHASES.md                  # Full implementation plan
└── setup.md                   # This file
```

---

## Troubleshooting

**`Error: Environment variable not found: DATABASE_URL`**  
→ The Prisma CLI reads `.env`, not `.env.local`. Create it:
```bash
echo 'DATABASE_URL="file:./vibesafe.db"' > .env
```

**`Cannot find module '@prisma/client'` or `PrismaClient is not a constructor`**  
→ The Prisma client needs to be generated. Run:
```bash
npx prisma generate
```
This happens automatically via `postinstall` on fresh installs, but may be needed if you switched branches with schema changes.

**`The table 'X' does not exist`**  
→ Migrations haven't been applied to your local DB. Run:
```bash
npm run db:migrate
```

**`Prisma schema is not in sync with migration history`**  
→ Your schema has unsaved changes. Either create a migration (`npm run db:migrate`) or reset (`npm run db:reset`).

**Scan stays on QUEUED and never progresses**  
→ The worker runs in-process during dev. Check the `npm run dev` terminal output for an error printed after the scan is created.

**Port 3000 already in use**  
→ Run on a different port:
```bash
npm run dev -- --port 3001
```
