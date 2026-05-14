import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/fp-rates/aggregate', () => ({
  aggregateFpRates: vi.fn(),
}));
vi.mock('@/lib/fp-rates/markdown-writer', () => ({
  writeFpRatesSection: vi.fn(),
}));

import { GET } from '@/app/api/cron/aggregate-fp-rates/route';
import { aggregateFpRates } from '@/lib/fp-rates/aggregate';
import { writeFpRatesSection } from '@/lib/fp-rates/markdown-writer';

function makeReq(headers: Record<string, string> = {}): any {
  const h = new Headers(headers);
  return { headers: h };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.CRON_SECRET;
  delete process.env.FP_RATES_WRITE_LOCAL;
  process.env.NODE_ENV = 'test';
  (aggregateFpRates as any).mockResolvedValue([
    {
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
    },
  ]);
});

describe('GET /api/cron/aggregate-fp-rates', () => {
  it('rejects unauthenticated requests in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CRON_SECRET = 's3cret';
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('accepts requests with the correct Bearer token', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CRON_SECRET = 's3cret';
    const res = await GET(makeReq({ authorization: 'Bearer s3cret' }));
    expect(res.status).toBe(200);
  });

  it('skips auth in non-production when CRON_SECRET is unset', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
  });

  it('returns aggregate counts and rates as JSON', async () => {
    const res = await GET(makeReq());
    const data = await res.json();
    expect(data.modulesUpdated).toBe(1);
    expect(data.totalDispositions).toBe(10);
    expect(data.rates[0].moduleId).toBe('P1-08');
    expect(typeof data.generatedAt).toBe('string');
  });

  it('does not write markdown unless FP_RATES_WRITE_LOCAL=1', async () => {
    const res = await GET(makeReq());
    const data = await res.json();
    expect(data.wroteMarkdown).toBe(false);
    expect(writeFpRatesSection).not.toHaveBeenCalled();
  });

  it('writes markdown when FP_RATES_WRITE_LOCAL=1', async () => {
    process.env.FP_RATES_WRITE_LOCAL = '1';
    (writeFpRatesSection as any).mockResolvedValue(undefined);
    const res = await GET(makeReq());
    const data = await res.json();
    expect(writeFpRatesSection).toHaveBeenCalledTimes(1);
    expect(data.wroteMarkdown).toBe(true);
  });
});
