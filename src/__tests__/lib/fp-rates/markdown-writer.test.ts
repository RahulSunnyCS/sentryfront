import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  writeFpRatesSection,
  BEGIN_MARKER,
  END_MARKER,
} from '@/lib/fp-rates/markdown-writer';
import type { ModuleRate } from '@/lib/fp-rates/aggregate';

const RATE: ModuleRate = {
  moduleId: 'P1-08',
  confidence: 'high',
  total: 10,
  helpfulCount: 8,
  dismissedCount: 1,
  fpCount: 1,
  fixDidntHelpCount: 0,
  missedOtherCount: 0,
  fpRate: 0.1,
  helpfulRate: 0.8,
};

const FIXED = new Date('2026-05-14T09:00:00.000Z');

describe('writeFpRatesSection', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fp-rates-'));
    file = path.join(dir, 'MODULE_QUALITY.md');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('appends both markers + body when the file is missing the section', async () => {
    await fs.writeFile(file, '# Module Quality Ledger\n\nNo telemetry yet.\n', 'utf8');
    await writeFpRatesSection([RATE], file, FIXED);
    const out = await fs.readFile(file, 'utf8');
    expect(out).toContain(BEGIN_MARKER);
    expect(out).toContain(END_MARKER);
    expect(out).toContain('P1-08');
    expect(out).toContain('10.0%'); // fpRate
    expect(out).toContain('80.0%'); // helpfulRate
    // Original content preserved.
    expect(out).toContain('No telemetry yet.');
  });

  it('replaces the section between sentinels when present', async () => {
    const initial = `# Heading\n\n${BEGIN_MARKER}\nstale content\n${END_MARKER}\n\nTrailing.\n`;
    await fs.writeFile(file, initial, 'utf8');
    await writeFpRatesSection([RATE], file, FIXED);
    const out = await fs.readFile(file, 'utf8');
    expect(out).not.toContain('stale content');
    expect(out).toContain('P1-08');
    expect(out).toContain('Trailing.');
    // Exactly one pair of markers remains.
    expect(out.match(new RegExp(BEGIN_MARKER, 'g'))).toHaveLength(1);
    expect(out.match(new RegExp(END_MARKER, 'g'))).toHaveLength(1);
  });

  it('is idempotent: running twice with the same input yields the same file', async () => {
    await fs.writeFile(file, '# Heading\n', 'utf8');
    await writeFpRatesSection([RATE], file, FIXED);
    const first = await fs.readFile(file, 'utf8');
    await writeFpRatesSection([RATE], file, FIXED);
    const second = await fs.readFile(file, 'utf8');
    expect(second).toBe(first);
  });

  it('renders the "no dispositions yet" body when rates are empty', async () => {
    await writeFpRatesSection([], file, FIXED);
    const out = await fs.readFile(file, 'utf8');
    expect(out).toContain('No dispositions recorded yet.');
  });
});
