# Local Setup Guide

## Prerequisites

- Node.js 18+ (`node --version`)
- npm 9+ (`npm --version`)
- Git

No database, Redis, or any external service is required to run locally.

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

## 3. Configure environment

Copy the example env file:

```bash
cp .env.example .env.local
```

The defaults in `.env.example` work out of the box — SQLite is used as the database and the scan worker runs in-process. No edits are needed for local development.

```env
# .env.local (defaults — no changes needed locally)
DATABASE_URL="file:./vibesafe.db"
```

## 4. Set up the database

Generate the Prisma client and apply migrations (creates `vibesafe.db` automatically):

```bash
npx prisma migrate dev
```

## 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How it works locally

| Concern | Local behaviour |
|---|---|
| Database | SQLite at `./vibesafe.db` — created automatically on first run |
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

## Optional: connect a real database

To use PostgreSQL instead of SQLite:

1. Edit `prisma/schema.prisma` — change the `provider`:

   ```prisma
   datasource db {
     provider = "postgresql"   // was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

2. Update `.env.local`:

   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/vibesafe"
   ```

3. Re-run migrations:

   ```bash
   npx prisma migrate dev
   ```

## Optional: connect Redis for background workers

Set `REDIS_URL` in `.env.local`:

```env
REDIS_URL="redis://localhost:6379"
```

When `REDIS_URL` is present:
- Scan jobs are published to a Redis queue (BullMQ)
- The SSE endpoint subscribes to a Redis pub/sub channel instead of polling
- Run a separate worker process alongside the Next.js dev server:

  ```bash
  # Terminal 1
  npm run dev

  # Terminal 2 — worker (once implemented in Phase 3+)
  npx tsx src/worker/index.ts
  ```

---

## Useful scripts

```bash
npm run dev          # Start Next.js dev server (http://localhost:3000)
npm run build        # Production build
npm run typecheck    # TypeScript type check (no emit)
npm run lint         # ESLint
npm run format       # Prettier

npx prisma studio    # Visual DB browser (http://localhost:5555)
npx prisma migrate dev --name <name>   # Create a new migration
npx prisma migrate reset               # Wipe and re-apply all migrations
```

---

## Project structure

```
sentryfront/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Migration history
├── src/
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── scan/[id]/         # Scanning progress screen
│   │   ├── report/[id]/       # Report dashboard
│   │   └── api/
│   │       ├── health/        # GET /api/health
│   │       └── v1/scans/      # Scan API endpoints
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
└── PHASES.md                  # Full implementation plan
```

---

## Troubleshooting

**`Error: Environment variable not found: DATABASE_URL`**
→ Make sure `.env.local` exists. Run `cp .env.example .env.local`.

**`Cannot find module '@prisma/client'`**
→ Run `npx prisma generate` to regenerate the client after a schema change.

**Scan stays on QUEUED and never progresses**
→ The worker runs in-process during dev. If `npm run dev` output shows an error after scan creation, check the terminal for the worker stack trace.

**Port 3000 already in use**
→ Run on a different port: `npm run dev -- --port 3001`
