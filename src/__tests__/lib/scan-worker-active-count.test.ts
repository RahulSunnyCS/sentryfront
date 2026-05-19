/**
 * Unit tests for the getActiveScanCount() getter exported by scan-worker.ts.
 *
 * The inc/dec lifecycle lives entirely inside the Promise.race in
 * runScanWithTimeout and cannot be driven in isolation without running a full
 * scan. The existing scan-worker.test.ts already covers the scan lifecycle
 * end-to-end (which implicitly exercises the counter path).
 *
 * This file focuses on the exported getter contract:
 *   - It exists and is callable.
 *   - It returns a number.
 *   - Its default value before any scan runs is 0.
 *
 * Full inc/dec integration coverage lives in the runScan() tests in
 * scan-worker.test.ts (the counter is exercised on every scan path).
 */

import { describe, it, expect } from 'vitest';

// Module mocks must be declared before the import under test so Vitest hoists
// them. These match the setup in the sibling scan-worker.test.ts file.
vi.mock('@/lib/scanner', () => ({
  runScanner: vi.fn(),
}));

vi.mock('@/lib/llm/enrichment', () => ({
  enrichFindingsWithLLM: vi.fn(),
}));

vi.mock('@/lib/events', () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getActiveScanCount } from '@/lib/scan-worker';

describe('getActiveScanCount()', () => {
  it('is exported and callable', () => {
    expect(typeof getActiveScanCount).toBe('function');
  });

  it('returns a number', () => {
    expect(typeof getActiveScanCount()).toBe('number');
  });

  it('returns 0 when no scans are in-flight (module-load default)', () => {
    // The counter starts at 0 and only increments inside runScanWithTimeout's
    // Promise.race. At module load time, before any scan is started, it is 0.
    expect(getActiveScanCount()).toBe(0);
  });

  it('returns a non-negative integer', () => {
    const count = getActiveScanCount();
    expect(count).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(count)).toBe(true);
  });
});
