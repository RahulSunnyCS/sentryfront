/**
 * Tests for src/lib/scanner/tools/seo-fetch.ts
 *
 * Covers:
 *   - isSafeFetchTarget(): SSRF guard
 *   - fetchTextSafe(): GET with safety check
 *   - probeImage(): HEAD-first, fallback to ranged GET
 *   - resolveCanonicalChain(): redirect-following with loop/block detection
 *   - w3cNuHasErrors(): W3C HTML validator wrapper (in test env, cache bypassed)
 *
 * fetch is mocked globally in vitest.setup.ts.
 * osv-cache is mocked to bypass Upstash dependency in w3cNuHasErrors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger to suppress warn output in tests
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Mock osv-cache so w3cNuHasErrors cache calls are no-ops in non-test env
vi.mock('@/lib/scanner/tools/osv-cache', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));

import {
  isSafeFetchTarget,
  fetchTextSafe,
  probeImage,
  resolveCanonicalChain,
  w3cNuHasErrors,
} from '@/lib/scanner/tools/seo-fetch';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// isSafeFetchTarget
// ---------------------------------------------------------------------------
describe('isSafeFetchTarget', () => {
  it('returns true for a public HTTPS URL', () => {
    expect(isSafeFetchTarget('https://example.com/page')).toBe(true);
  });

  it('returns true for a public HTTP URL', () => {
    expect(isSafeFetchTarget('http://example.com/')).toBe(true);
  });

  it('returns false for localhost', () => {
    expect(isSafeFetchTarget('http://localhost/admin')).toBe(false);
  });

  it('returns false for 127.0.0.1', () => {
    expect(isSafeFetchTarget('http://127.0.0.1/')).toBe(false);
  });

  it('returns false for 0.0.0.0', () => {
    expect(isSafeFetchTarget('http://0.0.0.0/')).toBe(false);
  });

  it('returns false for 169.254.169.254 (metadata service)', () => {
    expect(isSafeFetchTarget('http://169.254.169.254/latest/meta-data')).toBe(false);
  });

  it('returns false for 10.x.x.x private range', () => {
    expect(isSafeFetchTarget('http://10.0.0.1/internal')).toBe(false);
  });

  it('returns false for 192.168.x.x private range', () => {
    expect(isSafeFetchTarget('http://192.168.1.100/admin')).toBe(false);
  });

  it('returns false for 172.16-31.x.x private range', () => {
    expect(isSafeFetchTarget('http://172.20.0.1/')).toBe(false);
  });

  it('returns false for ftp:// protocol', () => {
    expect(isSafeFetchTarget('ftp://example.com/file')).toBe(false);
  });

  it('returns false for file:// protocol', () => {
    expect(isSafeFetchTarget('file:///etc/passwd')).toBe(false);
  });

  it('returns false for invalid URL strings', () => {
    expect(isSafeFetchTarget('not-a-url')).toBe(false);
    expect(isSafeFetchTarget('')).toBe(false);
  });

  it('returns false for javascript: URI', () => {
    expect(isSafeFetchTarget('javascript:alert(1)')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fetchTextSafe
// ---------------------------------------------------------------------------
describe('fetchTextSafe', () => {
  it('returns the response body text on success', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: async () => 'body content',
    } as unknown as Response);

    const result = await fetchTextSafe('https://example.com/robots.txt');
    expect(result).toBe('body content');
  });

  it('returns null when the response is not OK', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as unknown as Response);

    const result = await fetchTextSafe('https://example.com/missing.txt');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('AbortError'),
    );

    const result = await fetchTextSafe('https://example.com/slow.txt');
    expect(result).toBeNull();
  });

  it('returns null for a blocked (private IP) URL without making a network request', async () => {
    const result = await fetchTextSafe('http://10.0.0.1/internal');
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns null for localhost without fetching', async () => {
    const result = await fetchTextSafe('http://localhost:8080/secret');
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// probeImage
// ---------------------------------------------------------------------------
describe('probeImage', () => {
  it('returns reachable=true for a 200 image/png HEAD response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: (h: string) => (h === 'content-type' ? 'image/png' : null) },
    } as unknown as Response);

    const result = await probeImage('https://example.com/og.png');
    expect(result.reachable).toBe(true);
    expect(result.status).toBe(200);
    expect(result.contentType).toBe('image/png');
  });

  it('returns reachable=false when content-type is not image/', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: (h: string) => (h === 'content-type' ? 'text/html' : null) },
    } as unknown as Response);

    const result = await probeImage('https://example.com/page');
    expect(result.reachable).toBe(false);
  });

  it('falls back to ranged GET when HEAD returns 405', async () => {
    // First call (HEAD) → 405; second call (ranged GET) → 200 image/jpeg
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        status: 405,
        headers: { get: () => null },
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (h: string) => (h === 'content-type' ? 'image/jpeg' : null) },
      } as unknown as Response);

    const result = await probeImage('https://example.com/img.jpg');
    expect(result.reachable).toBe(true);
    expect(result.contentType).toBe('image/jpeg');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('falls back to ranged GET when HEAD returns 501', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        status: 501,
        headers: { get: () => null },
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (h: string) => (h === 'content-type' ? 'image/webp' : null) },
      } as unknown as Response);

    const result = await probeImage('https://example.com/img.webp');
    expect(result.reachable).toBe(true);
  });

  it('falls back to ranged GET when HEAD throws', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (h: string) => (h === 'content-type' ? 'image/gif' : null) },
      } as unknown as Response);

    const result = await probeImage('https://example.com/img.gif');
    expect(result.reachable).toBe(true);
  });

  it('returns miss when both HEAD and ranged GET throw', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('HEAD failed'))
      .mockRejectedValueOnce(new Error('GET failed'));

    const result = await probeImage('https://example.com/unreachable.png');
    expect(result.reachable).toBe(false);
    expect(result.status).toBeNull();
    expect(result.contentType).toBeNull();
  });

  it('returns miss for blocked (private) URLs', async () => {
    const result = await probeImage('http://10.0.0.1/image.png');
    expect(result.reachable).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns reachable=true for a 206 partial-content response with image/ type', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false, // 206 is not ok in fetch API
      status: 206,
      headers: { get: (h: string) => (h === 'content-type' ? 'image/jpeg' : null) },
    } as unknown as Response);

    const result = await probeImage('https://cdn.example.com/hero.jpg');
    // 206 is treated as success in the evaluate() function
    expect(result.status).toBe(206);
    expect(result.reachable).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveCanonicalChain
// ---------------------------------------------------------------------------
describe('resolveCanonicalChain', () => {
  it('returns status 200 for a direct 200 response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
    } as unknown as Response);

    const result = await resolveCanonicalChain('https://example.com/');
    expect(result.finalStatus).toBe(200);
    expect(result.hops).toBe(1);
    expect(result.loop).toBe(false);
    expect(result.blocked).toBe(false);
  });

  it('follows a redirect to its final destination', async () => {
    // First call: 301 to /new; second call: 200
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        status: 301,
        headers: { get: (h: string) => (h === 'location' ? 'https://example.com/new' : null) },
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
      } as unknown as Response);

    const result = await resolveCanonicalChain('https://example.com/old');
    expect(result.finalStatus).toBe(200);
    expect(result.hops).toBe(2);
    expect(result.loop).toBe(false);
  });

  it('detects redirect loops', async () => {
    // URL redirects to itself (loop)
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 301,
      headers: {
        get: (h: string) => (h === 'location' ? 'https://example.com/loop' : null),
      },
    } as unknown as Response);

    const result = await resolveCanonicalChain('https://example.com/loop', 3);
    expect(result.loop).toBe(true);
  });

  it('returns blocked=true for a blocked (private IP) startUrl', async () => {
    const result = await resolveCanonicalChain('http://10.0.0.1/');
    expect(result.blocked).toBe(true);
    expect(result.finalStatus).toBeNull();
  });

  it('returns blocked=true when a redirect leads to a private IP', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 302,
      headers: { get: (h: string) => (h === 'location' ? 'http://10.0.0.1/internal' : null) },
    } as unknown as Response);

    const result = await resolveCanonicalChain('https://example.com/redirect');
    expect(result.blocked).toBe(true);
  });

  it('returns finalStatus when redirect has no Location header', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 302,
      headers: { get: () => null }, // no Location
    } as unknown as Response);

    const result = await resolveCanonicalChain('https://example.com/bad-redirect');
    expect(result.finalStatus).toBe(302);
    expect(result.loop).toBe(false);
  });

  it('returns finalStatus when redirect Location is an unparseable URL', async () => {
    // new URL(loc, base) throws when loc contains null bytes or control chars.
    // Use a special scheme that causes URL parsing to fail.
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 302,
      // \x00 (null byte) causes URL constructor to throw
      headers: { get: (h: string) => (h === 'location' ? 'http://\x00bad.host/' : null) },
    } as unknown as Response);

    const result = await resolveCanonicalChain('https://example.com/bad-location');
    expect(result.finalStatus).toBe(302);
    expect(result.loop).toBe(false);
    expect(result.blocked).toBe(false);
  });

  it('returns loop=true after maxHops without reaching a terminus', async () => {
    // Each call redirects to a different URL so loop detection (seen set) doesn't fire,
    // but we hit the maxHops limit
    let counter = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      ok: false,
      status: 302,
      headers: { get: (h: string) => (h === 'location' ? `https://example.com/hop${++counter}` : null) },
    } as unknown as Response));

    const result = await resolveCanonicalChain('https://example.com/start', 3);
    expect(result.loop).toBe(true);
    expect(result.hops).toBe(3);
  });

  it('handles fetch throwing during chain resolution', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('timeout'));

    const result = await resolveCanonicalChain('https://example.com/');
    expect(result.finalStatus).toBeNull();
    expect(result.loop).toBe(false);
    expect(result.blocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// w3cNuHasErrors
// ---------------------------------------------------------------------------
describe('w3cNuHasErrors', () => {
  it('returns null for empty/whitespace-only HTML', async () => {
    const result = await w3cNuHasErrors('   ');
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns true when validator reports error messages', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [{ type: 'error', message: 'Stray end tag' }],
      }),
    } as unknown as Response);

    const result = await w3cNuHasErrors('<html><head></head><body></p></body></html>');
    expect(result).toBe(true);
  });

  it('returns false when validator reports no error messages', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [{ type: 'info', message: 'Advisory' }],
      }),
    } as unknown as Response);

    const result = await w3cNuHasErrors('<html><head></head><body><p>Valid</p></body></html>');
    expect(result).toBe(false);
  });

  it('returns false when messages array is empty', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [] }),
    } as unknown as Response);

    const result = await w3cNuHasErrors('<html><head></head><body></body></html>');
    expect(result).toBe(false);
  });

  it('returns null when validator response is non-OK', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as unknown as Response);

    const result = await w3cNuHasErrors('<html><head></head><body></body></html>');
    expect(result).toBeNull();
  });

  it('returns null when messages is not an array', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: 'not-an-array' }),
    } as unknown as Response);

    const result = await w3cNuHasErrors('<html><head></head><body></body></html>');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('service unavailable'),
    );

    const result = await w3cNuHasErrors('<html><head></head><body></body></html>');
    expect(result).toBeNull();
  });
});
