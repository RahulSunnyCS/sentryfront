/**
 * Phase 3.7 — markdown writer for the AUTO-FP-RATES section.
 *
 * Idempotent: if the sentinel pair exists, replace between them; if not,
 * append both markers + body at EOF. Runs only when FP_RATES_WRITE_LOCAL=1
 * (Vercel's runtime FS is read-only, so the cron route emits JSON and
 * delegates the commit to a CI runner).
 */

import { promises as fs } from 'fs';
import type { ModuleRate } from './aggregate';

export const BEGIN_MARKER = '<!-- BEGIN AUTO-FP-RATES -->';
export const END_MARKER = '<!-- END AUTO-FP-RATES -->';

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function renderFpRatesBlock(rates: ModuleRate[], generatedAt: Date): string {
  const lines: string[] = [];
  lines.push(BEGIN_MARKER);
  lines.push('');
  lines.push(`_Generated: ${generatedAt.toISOString()}_`);
  lines.push('');
  lines.push(
    '_Only explicit "False positive" clicks count toward FP rate. ' +
      'Dismiss and "Fix didn\'t help" are tracked separately. ' +
      'Corpus is the recall floor — no detection change without a green corpus run._',
  );
  lines.push('');
  if (rates.length === 0) {
    lines.push('_No dispositions recorded yet._');
  } else {
    lines.push(
      '| Module | Confidence | Samples | Helpful | Dismissed | FP | Fix didn\'t help | FP rate | Helpful rate |',
    );
    lines.push('|---|---|---|---|---|---|---|---|---|');
    for (const r of rates) {
      lines.push(
        `| ${r.moduleId} | ${r.confidence ?? '_(none)_'} | ${r.total} | ${r.helpfulCount} | ${r.dismissedCount} | ${r.fpCount} | ${r.fixDidntHelpCount} | ${formatPct(r.fpRate)} | ${formatPct(r.helpfulRate)} |`,
      );
    }
  }
  lines.push('');
  lines.push(END_MARKER);
  return lines.join('\n');
}

export async function writeFpRatesSection(
  rates: ModuleRate[],
  filePath: string,
  generatedAt: Date = new Date(),
): Promise<void> {
  const block = renderFpRatesBlock(rates, generatedAt);
  let existing = '';
  try {
    existing = await fs.readFile(filePath, 'utf8');
  } catch {
    existing = '';
  }

  const beginIdx = existing.indexOf(BEGIN_MARKER);
  const endIdx = existing.indexOf(END_MARKER);

  let next: string;
  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    const before = existing.slice(0, beginIdx);
    const after = existing.slice(endIdx + END_MARKER.length);
    next = `${before}${block}${after}`;
  } else {
    const sep = existing.endsWith('\n') || existing.length === 0 ? '\n' : '\n\n';
    next = `${existing}${sep}${block}\n`;
  }

  await fs.writeFile(filePath, next, 'utf8');
}
