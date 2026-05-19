/**
 * Unit tests for the redactUrls helper exported from sentry.server.config.ts.
 *
 * Security contract: no URL path, query string, fragment, or embedded token
 * survives after redaction. Only scheme+host are preserved.
 *
 * Import safety: sentry.server.config.ts calls Sentry.init() only when BOTH
 * SENTRY_ENABLED==='true' AND SENTRY_DSN are set. vitest.setup.ts sets neither
 * of those, so importing the module is inert (Sentry.init is never called).
 * The @sentry/nextjs mock in vitest.setup.ts guards the import at the module level.
 */

import { describe, it, expect } from 'vitest';
// Import only the exported function — the module-level Sentry.init() guard
// in the config file means this import is safe in the test environment.
import { redactUrls } from '../../sentry.server.config';

describe('redactUrls()', () => {
  // ── Basic structural redaction ──────────────────────────────────────────────

  it('strips the path from a URL, keeping scheme and host', () => {
    const result = redactUrls('https://example.com/some/path');
    expect(result).toBe('https://example.com/[redacted]');
    expect(result).not.toContain('/some/path');
  });

  it('strips a query string from a URL', () => {
    const result = redactUrls('https://example.com?foo=bar');
    expect(result).not.toContain('foo=bar');
    expect(result).toContain('example.com');
  });

  it('strips a URL fragment', () => {
    const result = redactUrls('https://example.com#section');
    expect(result).not.toContain('#section');
    expect(result).toContain('example.com');
  });

  it('keeps scheme and host intact', () => {
    const result = redactUrls('https://my-target-site.io/path?x=1');
    expect(result).toContain('https://my-target-site.io');
  });

  // ── Security assertion: tokens in query strings must not survive ─────────────

  it('does not leak a secret token embedded in a query string', () => {
    const input = 'https://site.com/api/callback?token=super_secret_abc123&user=42';
    const result = redactUrls(input);
    expect(result).not.toContain('super_secret_abc123');
    expect(result).not.toContain('token=');
    expect(result).not.toContain('user=42');
    expect(result).toContain('https://site.com');
  });

  it('does not leak an API key embedded in a path segment', () => {
    const input = 'https://api.example.com/v1/sk-live-verysecretkey/resource';
    const result = redactUrls(input);
    expect(result).not.toContain('sk-live-verysecretkey');
    expect(result).toContain('https://api.example.com');
  });

  // ── URL embedded in a longer message ────────────────────────────────────────

  it('redacts a URL embedded in a longer error message', () => {
    const input = 'Navigation failed for https://site.com/secret?token=abc while loading';
    const result = redactUrls(input);
    expect(result).not.toContain('/secret');
    expect(result).not.toContain('token=abc');
    expect(result).toContain('https://site.com');
    // Non-URL parts of the message are preserved
    expect(result).toContain('Navigation failed for');
    expect(result).toContain('while loading');
  });

  it('redacts multiple URLs in the same string', () => {
    const input = 'Fetched https://first.com/path?a=1 and https://second.org/other#frag';
    const result = redactUrls(input);
    expect(result).not.toContain('/path');
    expect(result).not.toContain('a=1');
    expect(result).not.toContain('/other');
    expect(result).not.toContain('#frag');
    expect(result).toContain('https://first.com');
    expect(result).toContain('https://second.org');
  });

  // ── No-op cases ─────────────────────────────────────────────────────────────

  it('returns the original string unchanged when it contains no URL', () => {
    const input = 'A plain error message with no URL at all';
    expect(redactUrls(input)).toBe(input);
  });

  it('returns undefined for null input', () => {
    expect(redactUrls(null)).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(redactUrls(undefined)).toBeUndefined();
  });

  it('handles a bare host with no path (scheme+host only)', () => {
    // A URL with no path, query, or fragment — should remain effectively intact
    // (the replacement appends /[redacted] regardless, matching the regex)
    const result = redactUrls('https://example.com');
    expect(result).toContain('https://example.com');
    expect(result).not.toContain('?');
    expect(result).not.toContain('#');
  });

  it('handles an empty string without throwing', () => {
    expect(redactUrls('')).toBe('');
  });

  // ── http (non-TLS) URLs ──────────────────────────────────────────────────────

  it('redacts http:// URLs as well as https://', () => {
    const result = redactUrls('http://insecure.com/path?secret=value');
    expect(result).not.toContain('/path');
    expect(result).not.toContain('secret=value');
    expect(result).toContain('http://insecure.com');
  });
});
