import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Playwright globalSetup — runs ONCE before any browser context opens,
 * and therefore BEFORE the webServer starts.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  ORDERING INVARIANT — DO NOT REORDER THESE STEPS                ║
 * ║                                                                  ║
 * ║  This file MUST complete in full before webServer starts.        ║
 * ║  Playwright guarantees: globalSetup → webServer → specs.         ║
 * ║                                                                  ║
 * ║  Seeding (user rows, scan rows, etc.) belongs in per-spec        ║
 * ║  beforeAll/beforeEach hooks, NOT here. Moving seed logic into    ║
 * ║  globalSetup or any server-parallel hook risks race conditions   ║
 * ║  and creates implicit cross-spec state dependencies.             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
export default async function globalSetup() {
  const repoRoot = path.resolve(__dirname, '../../');
  const schemaPath = path.join(repoRoot, 'prisma/schema.prisma');

  // ── Step 1: delete any leftover e2e database files ────────────────
  //
  // SQLite creates up to three files: the main db, a WAL journal, and a
  // shared-memory file.  Removing all three gives every run an empty
  // schema with no pre-existing rows — the precondition every spec
  // assumes.  Silence ENOENT (files simply don't exist on first run).
  for (const suffix of ['', '-wal', '-shm']) {
    const dbFile = path.join(repoRoot, `e2e.db${suffix}`);
    try {
      fs.unlinkSync(dbFile);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  // ── Step 2: rewrite prisma/schema.prisma → SQLite (development) ───
  //
  // db-config.js rewrites the datasource block in place.  Passing
  // 'development' explicitly bypasses the NODE_ENV/VERCEL_ENV heuristic
  // so the schema is always SQLite regardless of the ambient environment
  // the E2E process inherits.
  execSync('node scripts/db-config.js development', {
    cwd: repoRoot,
    stdio: 'inherit', // surface any error output
  });

  // ── Step 3: assert the schema is now SQLite ────────────────────────
  //
  // If db-config.js somehow wrote 'postgresql' (e.g. a future regression
  // in the script or a concurrent production run that clobbered the file),
  // running prisma db push would target PostgreSQL and either fail or —
  // worse — corrupt the production database.  Hard-fail here with a clear
  // message so the problem is immediately obvious.
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  // Extract the provider value from the datasource block.
  const providerMatch = schemaContent.match(/datasource\s+db\s*\{[^}]*provider\s*=\s*"([^"]+)"/);
  const provider = providerMatch?.[1];

  if (provider !== 'sqlite') {
    throw new Error(
      `[globalSetup] prisma/schema.prisma datasource provider is "${provider ?? '(not found)'}",` +
        ` expected "sqlite". This means db-config.js did not rewrite the schema correctly,` +
        ` or a concurrent process replaced it with the production config.` +
        ` Aborting E2E run to prevent accidental writes to a non-SQLite database.`,
    );
  }

  // ── Step 4: push the SQLite schema to create e2e.db ───────────────
  //
  // prisma db push creates the e2e.db file and applies the full schema
  // without running migrations.  This is the correct command for an
  // isolated, throw-away database that doesn't need migration history.
  //
  // DEV_DATABASE_URL=file:./e2e.db is set explicitly here to ensure the
  // E2E database is always the isolated file — even if .env sets a
  // different path (e.g. vibesafe.db).  The webServer process inherits
  // the same variable via playwright.config.ts webServer.env, so the
  // running server reads from exactly the same file this step created.
  execSync('npx prisma db push --skip-generate', {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      DEV_DATABASE_URL: 'file:./e2e.db',
    },
  });

  // ── Step 5: NO seeding ────────────────────────────────────────────
  //
  // Each spec owns its own seed/cleanup lifecycle via beforeAll/beforeEach
  // and afterAll/afterEach hooks in the spec file or a dedicated seed
  // helper (e.g. e2e/support/perf-db-seed.ts).  Seeding here would
  // create implicit ordering dependencies between specs and make cleanup
  // harder to reason about.  The clean schema is the only shared
  // precondition globalSetup provides.
}
