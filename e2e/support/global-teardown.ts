import { execSync } from 'child_process';
import path from 'path';

/**
 * Playwright globalTeardown — runs ONCE after all specs finish.
 *
 * Responsibility: restore prisma/schema.prisma to its committed SQLite
 * state so that local developers who ran the E2E suite don't find their
 * schema file dirtied after the run.
 *
 * Why only on CI?
 * ───────────────
 * During local development a developer may have uncommitted schema
 * edits in progress (e.g. adding a new model or column while writing
 * a feature).  Running `git checkout -- prisma/schema.prisma` would
 * silently discard those in-progress changes.  On CI the working tree
 * is always clean (no in-progress edits), so the restore is safe and
 * ensures subsequent steps (build, typecheck) see the canonical file.
 *
 * The committed schema.prisma already has the SQLite datasource block
 * (confirmed in wave0-recon.md §d), so the restore is a no-op when
 * globalSetup's db-config.js wrote an identical block — but it is a
 * safety net if the script ever writes a non-identical block.
 */
export default async function globalTeardown() {
  // Only restore on CI — protect in-progress local schema edits.
  if (!process.env.CI) {
    return;
  }

  const repoRoot = path.resolve(__dirname, '../../');

  execSync('git checkout -- prisma/schema.prisma', {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}
