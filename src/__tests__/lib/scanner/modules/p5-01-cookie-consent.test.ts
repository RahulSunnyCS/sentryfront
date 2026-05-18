/**
 * Unit tests for P5-01 — Cookie Consent Signal.
 *
 * Covers: happy path (CMP detected), edge cases (no cookies, fetch-only,
 * consent-record-only cookies), and the mandatory invariants:
 *  - INVARIANT #1: no outbound network (global fetch never called)
 *  - INVARIANT #2: fail-closed — fetch-only / no rendered DOM → neutral INFO
 *  - INVARIANT #4: no numeric score / no attestation vocabulary
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runCookieConsentModule } from '@/lib/scanner/modules/p5-01-cookie-consent';
import {
  makeCrawl,
  makeCtx,
  makeCookie,
  makeNetworkRequest,
  assertNoAttestationLanguage,
} from './p5-test-helpers';

describe('P5-01 cookie consent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fail-closed (INVARIANT #2)', () => {
    it('emits a single neutral INFO when renderMode is fetch-only', () => {
      const findings = runCookieConsentModule(
        makeCrawl({ renderMode: 'fetch-only', html: '<html></html>' }),
        makeCtx(),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('INFO');
      expect(findings[0].title.toLowerCase()).toContain('not evaluated');
      assertNoAttestationLanguage(findings[0]);
    });

    it('emits a single neutral INFO when headless but no rendered DOM present', () => {
      const findings = runCookieConsentModule(
        makeCrawl({ renderMode: 'headless' }),
        makeCtx(),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('INFO');
      expect(findings[0].title.toLowerCase()).toContain('not evaluated');
    });

    it('never emits a negative (LOW/MEDIUM) finding on the fail-closed path even with tracking cookies', () => {
      const findings = runCookieConsentModule(
        makeCrawl({
          renderMode: 'fetch-only',
          html: '<html></html>',
          cookies: [makeCookie({ name: '_ga' }), makeCookie({ name: '_fbp' })],
        }),
        makeCtx(),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('INFO');
    });
  });

  describe('happy path — CMP detected', () => {
    it('emits an INFO observation when a CMP DOM marker is present', () => {
      const html =
        '<html><body><div id="onetrust-banner-sdk"></div></body></html>';
      const findings = runCookieConsentModule(
        makeCrawl({ renderMode: 'headless', renderedHtml: html, cleanedHtml: html }),
        makeCtx(),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('INFO');
      expect(findings[0].title).toContain('Consent mechanism observed');
      expect(findings[0].title).toContain('OneTrust');
      assertNoAttestationLanguage(findings[0]);
    });

    it('detects a CMP via a third-party script network request', () => {
      const html = '<html><body>hello</body></html>';
      const findings = runCookieConsentModule(
        makeCrawl({
          renderMode: 'headless',
          renderedHtml: html,
          cleanedHtml: html,
          networkRequests: [
            makeNetworkRequest({ url: 'https://consent.cookiebot.com/uc.js' }),
          ],
        }),
        makeCtx(),
      );
      expect(findings[0].title).toContain('Cookiebot');
    });
  });

  describe('no CMP — cookie heuristics', () => {
    it('emits MEDIUM when analytics cookies are present and no CMP detected', () => {
      const html = '<html><body>no banner here</body></html>';
      const findings = runCookieConsentModule(
        makeCrawl({
          renderMode: 'headless',
          renderedHtml: html,
          cleanedHtml: html,
          cookies: [makeCookie({ name: '_ga' })],
        }),
        makeCtx(),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('MEDIUM');
      assertNoAttestationLanguage(findings[0]);
    });

    it('emits LOW when only consent-record cookies are present', () => {
      const html = '<html><body>nothing</body></html>';
      const findings = runCookieConsentModule(
        makeCrawl({
          renderMode: 'headless',
          renderedHtml: html,
          cleanedHtml: html,
          cookies: [makeCookie({ name: 'CookieConsent' })],
        }),
        makeCtx(),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('LOW');
    });

    it('returns no findings when no CMP and only essential cookies present', () => {
      const html = '<html><body>clean</body></html>';
      const findings = runCookieConsentModule(
        makeCrawl({
          renderMode: 'headless',
          renderedHtml: html,
          cleanedHtml: html,
          cookies: [makeCookie({ name: 'csrf_token' })],
        }),
        makeCtx(),
      );
      expect(findings).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('handles absent cookies and absent networkRequests without throwing', () => {
      const html = '<html><body>x</body></html>';
      expect(() =>
        runCookieConsentModule(
          makeCrawl({ renderMode: 'headless', renderedHtml: html, cleanedHtml: html }),
          makeCtx(),
        ),
      ).not.toThrow();
    });

    it('skips malformed network request URLs gracefully', () => {
      const html = '<html><body>x</body></html>';
      expect(() =>
        runCookieConsentModule(
          makeCrawl({
            renderMode: 'headless',
            renderedHtml: html,
            cleanedHtml: html,
            networkRequests: [makeNetworkRequest({ url: 'not a url' })],
          }),
          makeCtx(),
        ),
      ).not.toThrow();
    });
  });

  describe('INVARIANT #1 — no outbound network', () => {
    it('does not call global fetch on any path', () => {
      const html = '<html><body><div id="onetrust-banner-sdk"></div></body></html>';
      runCookieConsentModule(
        makeCrawl({ renderMode: 'headless', renderedHtml: html, cleanedHtml: html }),
        makeCtx(),
      );
      runCookieConsentModule(
        makeCrawl({ renderMode: 'fetch-only', html: '<html></html>' }),
        makeCtx(),
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
