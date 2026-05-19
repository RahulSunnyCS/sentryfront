/**
 * Wave-3 🟢 non-blocker — Coverage-matrix anti-orphan gate (T-16).
 *
 * This spec imports the static coverage matrix from
 * e2e/support/coverage-matrix.ts and verifies that every item in the
 * VibeSafe surface inventory (28 pages + 31 components) has at least one
 * spec file that exercises it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ORPHAN POLICY (mirrors coverage-matrix.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * HARD orphan — coverage array is empty OR has no DIRECT/TRANSITIVE/PARTIAL
 *               entry. This means no spec was ever written that exercises the
 *               item.  → TEST FAILS.
 *
 * SOFT orphan — all coverage entries are CONDITIONAL (env-gated). The item
 *               IS documented and the gap is intentional (a feature-flag-
 *               gated surface not observable in the standard e2e env).
 *               → TEST WARNS via console.warn; does NOT fail.
 *
 * The current expected soft-orphan count is 1:
 *   • component/mock-mode-banner — only renders when FEATURES.mockMode=true,
 *     which is not set in the e2e webServer env. See coverage-matrix.ts for
 *     the full rationale and the steps to close the gap.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TAGGING: @non-blocker
 * ─────────────────────────────────────────────────────────────────────────────
 * Per pipeline/qa-checklist.md this test is 🟢 Non-blocker:
 *   "A missing spec for an inventory item is a documentation / process gap,
 *    not a runtime breakage."
 * A failure here surfaces an orphan to the human reviewer without blocking
 * the Automation Gate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NO BROWSER / NO SERVER REQUIRED
 * ─────────────────────────────────────────────────────────────────────────────
 * This spec imports a TypeScript module (coverage-matrix.ts) and runs pure
 * in-process assertions. It never navigates to a URL, so it does not need
 * a running dev server. It runs as part of `npx playwright test` like all
 * other specs — Playwright's Node.js test runner executes it natively.
 */

import { test, expect } from '@playwright/test';
import {
  INVENTORY,
  getCoverageSummary,
  type OrphanResult,
} from './support/coverage-matrix';

// ── Helper: format an orphan for the failure / warning message ────────────────

function formatOrphan(o: OrphanResult): string {
  const item = o.item;
  const label = `[${item.kind}] ${item.id} (${item.path})`;
  if (item.coverage.length === 0) {
    return `  ${label}\n    → NO coverage entries whatsoever — add a spec.`;
  }
  const conditionalNotes = item.coverage
    .map((e) => `    CONDITIONAL: ${e.note ?? '(no note)'}`)
    .join('\n');
  return `  ${label}\n${conditionalNotes}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: inventory count sanity check
// Asserts the matrix has the expected number of items so that a mis-paste or
// truncation in coverage-matrix.ts is caught immediately. Adjust the constant
// if the surface inventory legitimately changes (add a note explaining why).
// ─────────────────────────────────────────────────────────────────────────────

test('@non-blocker coverage matrix contains all 60 inventory items (29 pages + 31 components)', () => {
  const summary = getCoverageSummary();

  // The context-pack says "~28 pages" — the tilde is because auth/popup-start
  // and auth/popup-callback are listed together as one item. The actual count
  // when each is its own discrete page is 29. The matrix lists each page once,
  // so the authoritative count here is 29 pages.
  expect(
    summary.pages,
    `Expected 29 pages in the coverage matrix, found ${summary.pages}. ` +
      `If the surface inventory has changed, update coverage-matrix.ts and this count.`,
  ).toBe(29);

  expect(
    summary.components,
    `Expected 31 components in the coverage matrix, found ${summary.components}. ` +
      `If the surface inventory has changed, update coverage-matrix.ts and this count.`,
  ).toBe(31);

  expect(
    summary.total,
    `Expected 60 total items (29 + 31), found ${summary.total}.`,
  ).toBe(60);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: zero hard orphans
// FAILS if any inventory item has no spec (hard orphan).
// ─────────────────────────────────────────────────────────────────────────────

test('@non-blocker every inventory page and component has at least one spec mapped (anti-orphan gate)', () => {
  const summary = getCoverageSummary();

  const hardOrphans = summary.orphanDetails.filter((o) => o.severity === 'hard');
  const softOrphans = summary.orphanDetails.filter((o) => o.severity === 'soft');

  // Log soft-orphans (CONDITIONAL-only) as warnings so the reviewer can see them
  // without failing the gate. These are env-gated gaps, not missing specs.
  if (softOrphans.length > 0) {
    const softDetails = softOrphans.map(formatOrphan).join('\n');
    // eslint-disable-next-line no-console
    console.warn(
      `[coverage-matrix] ${softOrphans.length} CONDITIONAL-only (soft) orphan(s) — ` +
        `documented env-gated gaps, not blocking:\n${softDetails}`,
    );
  }

  // Print a coverage summary to the test output regardless of pass/fail so
  // the reviewer can see the coverage posture at a glance.
  // eslint-disable-next-line no-console
  console.log(
    `[coverage-matrix] Summary: ${summary.covered}/${summary.total} items covered ` +
      `(${summary.pages} pages, ${summary.components} components). ` +
      `Hard orphans: ${summary.hardOrphans}. Soft orphans (CONDITIONAL): ${summary.softOrphans}.`,
  );

  // The gate: fail if there are hard orphans.
  if (hardOrphans.length > 0) {
    const hardDetails = hardOrphans.map(formatOrphan).join('\n');
    expect(
      hardOrphans,
      `${hardOrphans.length} inventory item(s) have NO spec coverage (hard orphans). ` +
        `Add a spec for each item, or move it to a CONDITIONAL entry with a documented reason:\n` +
        hardDetails,
    ).toHaveLength(0);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: all spec filenames referenced in the matrix are real files
// This prevents typos in coverage-matrix.ts from silently creating phantom
// coverage that looks mapped but references a non-existent spec.
// ─────────────────────────────────────────────────────────────────────────────

test('@non-blocker all spec files referenced in the coverage matrix exist on disk', async () => {
  // Collect every unique spec filename from the matrix (exclude blank strings
  // used by CONDITIONAL entries that have no associated spec file).
  const referencedSpecs = new Set<string>();
  for (const item of INVENTORY) {
    for (const entry of item.coverage) {
      if (entry.spec) {
        referencedSpecs.add(entry.spec);
      }
    }
  }

  // Use Node.js fs to check each referenced spec file exists under e2e/.
  // We import fs dynamically so this remains a Playwright test (not a Vitest test).
  const { existsSync, realpathSync } = await import('fs');
  const { resolve, dirname } = await import('path');

  // __filename in the Playwright test runner is the compiled test file.
  // We resolve paths relative to this file's directory (e2e/).
  // Note: Playwright esbuild compilation places the output in a temp dir;
  // we use import.meta.url via process.cwd() + 'e2e/' as the reliable base.
  // process.cwd() in the playwright runner is the project root (sentryfront/).
  const e2eDir = resolve(process.cwd(), 'e2e');

  // Confirm the e2e dir itself exists (sanity check that cwd is correct).
  expect(
    existsSync(e2eDir),
    `Expected e2e/ directory to exist at ${e2eDir}. Is process.cwd() the project root?`,
  ).toBe(true);

  const missingSpecs: string[] = [];
  for (const specFile of referencedSpecs) {
    const fullPath = resolve(e2eDir, specFile);
    if (!existsSync(fullPath)) {
      missingSpecs.push(`${specFile} (expected at ${fullPath})`);
    }
  }

  // Silence the unused-variable warning on dirname — we just need the import.
  void dirname;
  void realpathSync;

  expect(
    missingSpecs,
    `${missingSpecs.length} spec file(s) referenced in coverage-matrix.ts do NOT exist on disk. ` +
      `Fix the typo in coverage-matrix.ts or create the missing spec:\n` +
      missingSpecs.map((s) => `  ${s}`).join('\n'),
  ).toHaveLength(0);
});
