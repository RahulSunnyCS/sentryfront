import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the prisma client BEFORE importing the module under test.
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: { featureFlag: { findUnique } },
}));

import {
  getFeatureFlag,
  invalidateFeatureFlag,
  _resetFeatureFlagCacheForTests,
} from '@/lib/feature-flags';

describe('getFeatureFlag', () => {
  beforeEach(() => {
    findUnique.mockReset();
    _resetFeatureFlagCacheForTests();
  });

  it('returns DB row when present', async () => {
    findUnique.mockResolvedValueOnce({ enabled: true, value: '{"depth":3}' });
    const r = await getFeatureFlag<{ depth: number }>('seo-depth');
    expect(r.enabled).toBe(true);
    expect(r.value).toEqual({ depth: 3 });
  });

  it('falls back to envDefault when no DB row', async () => {
    findUnique.mockResolvedValueOnce(null);
    const r = await getFeatureFlag('absent', { enabled: true, value: 42 });
    expect(r.enabled).toBe(true);
    expect(r.value).toBe(42);
  });

  it('falls back to {enabled:false,value:null} when neither DB row nor envDefault', async () => {
    findUnique.mockResolvedValueOnce(null);
    const r = await getFeatureFlag('nada');
    expect(r).toEqual({ enabled: false, value: null });
  });

  it('caches results — second call within TTL does not re-query DB', async () => {
    findUnique.mockResolvedValueOnce({ enabled: true, value: null });
    await getFeatureFlag('cached');
    await getFeatureFlag('cached');
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('invalidateFeatureFlag(key) forces a re-read', async () => {
    findUnique.mockResolvedValueOnce({ enabled: false, value: null });
    await getFeatureFlag('k');
    invalidateFeatureFlag('k');
    findUnique.mockResolvedValueOnce({ enabled: true, value: null });
    const r = await getFeatureFlag('k');
    expect(r.enabled).toBe(true);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('treats unparseable stored value as null without throwing', async () => {
    findUnique.mockResolvedValueOnce({ enabled: true, value: 'not-json' });
    const r = await getFeatureFlag('bad');
    expect(r.enabled).toBe(true);
    expect(r.value).toBeNull();
  });

  it('falls back to envDefault on DB error', async () => {
    findUnique.mockRejectedValueOnce(new Error('boom'));
    const r = await getFeatureFlag('err', { enabled: true, value: 'x' });
    expect(r).toEqual({ enabled: true, value: 'x' });
  });
});
