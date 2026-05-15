import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getObservatoryGrade } from '@/lib/scanner/tools/observatory';

const mockFetch = vi.mocked(fetch);

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response;
}

describe('getObservatoryGrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns grade + score from a flat v2 body', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ grade: 'B+', score: 75 }));
    expect(await getObservatoryGrade('example.com')).toEqual({ grade: 'B+', score: 75 });
  });

  it('returns grade + score from a nested scan body', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ scan: { grade: 'A', score: 100 } }));
    expect(await getObservatoryGrade('example.com')).toEqual({ grade: 'A', score: 100 });
  });

  it('fails soft to null on a network error (never throws)', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNRESET'));
    await expect(getObservatoryGrade('example.com')).resolves.toBeNull();
  });

  it('fails soft to null on a non-2xx response', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ grade: 'F', score: 0 }, false));
    expect(await getObservatoryGrade('example.com')).toBeNull();
  });

  it('returns null on an unexpected body shape', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ unexpected: true }));
    expect(await getObservatoryGrade('example.com')).toBeNull();
  });

  it('rejects an invalid host without making a request', async () => {
    expect(await getObservatoryGrade('http://evil.example.com/path')).toBeNull();
    expect(await getObservatoryGrade('')).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
