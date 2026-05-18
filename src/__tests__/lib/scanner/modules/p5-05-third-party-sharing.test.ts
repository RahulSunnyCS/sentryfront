/**
 * Unit tests for P5-05 — Third-Party Data Sharing.
 *
 * Covers: happy path (processors + privacy link → INFO), edge cases (none,
 * unparseable finalUrl, fetch-only no networkRequests), and the mandatory
 * invariants:
 *  - INVARIANT #1: no outbound network (pure function)
 *  - INVARIANT #4: no numeric score / no attestation vocabulary
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runThirdPartyDataSharingModule } from '@/lib/scanner/modules/p5-05-third-party-sharing';
import {
  makeCrawl,
  makeCtx,
  makeCookie,
  makeNetworkRequest,
  assertNoAttestationLanguage,
} from './p5-test-helpers';

describe('P5-05 third-party data sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits an INFO "no processors" finding when none observed', () => {
    const findings = runThirdPartyDataSharingModule(
      makeCrawl({ finalUrl: 'https://example.com/' }),
      makeCtx(),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('INFO');
    expect(findings[0].title).toContain('No third-party data processors observed');
    assertNoAttestationLanguage(findings[0]);
  });

  it('emits LOW when processors are present but no privacy link is observed', () => {
    const findings = runThirdPartyDataSharingModule(
      makeCrawl({
        finalUrl: 'https://example.com/',
        jsBundleUrls: ['https://www.google-analytics.com/ga.js'],
        cleanedHtml: '<html><body><a href="/about">About</a></body></html>',
      }),
      makeCtx(),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('LOW');
    expect(findings[0].title).toContain('no privacy-policy link observed');
    expect(findings[0].evidence).toContain('Google Analytics');
    assertNoAttestationLanguage(findings[0]);
  });

  it('emits INFO when processors are present and a privacy link is observed', () => {
    const findings = runThirdPartyDataSharingModule(
      makeCrawl({
        finalUrl: 'https://example.com/',
        jsBundleUrls: ['https://js.stripe.com/v3/'],
        cleanedHtml:
          '<html><body><a href="/privacy">Privacy Policy</a></body></html>',
      }),
      makeCtx(),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('INFO');
    expect(findings[0].title).toContain('privacy policy link present');
    assertNoAttestationLanguage(findings[0]);
  });

  it('collects processors from cookies and network requests too', () => {
    const findings = runThirdPartyDataSharingModule(
      makeCrawl({
        finalUrl: 'https://example.com/',
        networkRequests: [
          makeNetworkRequest({ url: 'https://connect.facebook.net/pixel.js' }),
        ],
        cookies: [makeCookie({ name: '_ga', domain: '.doubleclick.net' })],
        cleanedHtml: '<html><body>no link</body></html>',
      }),
      makeCtx(),
    );
    expect(findings[0].severity).toBe('LOW');
    expect(findings[0].evidence).toMatch(/Facebook Pixel|Google Ads/);
  });

  it('excludes the first-party host (www-stripped) from processors', () => {
    const findings = runThirdPartyDataSharingModule(
      makeCrawl({
        finalUrl: 'https://example.com/',
        jsBundleUrls: ['https://www.example.com/app.js'],
      }),
      makeCtx(),
    );
    expect(findings[0].title).toContain('No third-party data processors observed');
  });

  it('returns no findings when finalUrl is unparseable', () => {
    const findings = runThirdPartyDataSharingModule(
      makeCrawl({ finalUrl: 'not a url' }),
      makeCtx(),
    );
    expect(findings).toEqual([]);
  });

  describe('INVARIANT #1 — no outbound network', () => {
    it('does not call global fetch on any path', () => {
      runThirdPartyDataSharingModule(
        makeCrawl({ finalUrl: 'https://example.com/' }),
        makeCtx(),
      );
      runThirdPartyDataSharingModule(
        makeCrawl({
          finalUrl: 'https://example.com/',
          jsBundleUrls: ['https://www.google-analytics.com/ga.js'],
          cleanedHtml: '<a href="/privacy">Privacy</a>',
        }),
        makeCtx(),
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
