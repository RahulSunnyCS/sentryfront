/**
 * Unit tests for P5-02 — Privacy Policy Presence.
 *
 * Covers: happy path (link observed), edge cases (no DOM, fetch-only), and the
 * mandatory invariants:
 *  - INVARIANT #1: no outbound network (global fetch never called)
 *  - INVARIANT #2: fail-closed — no DOM → neutral INFO (never a negative verdict)
 *  - INVARIANT #3: C1 PII/token leak fixed — query/fragment/email/token stripped
 *  - INVARIANT #4: no numeric score / no attestation vocabulary
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runPrivacyPolicyModule } from '@/lib/scanner/modules/p5-02-privacy-policy';
import { makeCrawl, makeCtx, assertNoAttestationLanguage } from './p5-test-helpers';

describe('P5-02 privacy policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fail-closed (INVARIANT #2)', () => {
    it('emits a single neutral INFO when no HTML is available (fetch-only empty body)', () => {
      const findings = runPrivacyPolicyModule(
        makeCrawl({ renderMode: 'fetch-only', html: '' }),
        makeCtx(),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('INFO');
      expect(findings[0].title.toLowerCase()).toContain('not evaluated');
    });

    it('emits INFO (never LOW) when html is whitespace only', () => {
      const findings = runPrivacyPolicyModule(
        makeCrawl({ html: '   \n  ' }),
        makeCtx(),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('INFO');
      expect(findings[0].severity).not.toBe('LOW');
    });
  });

  describe('happy path — link observed', () => {
    it('emits an INFO observation when a privacy policy link is present', () => {
      const html =
        '<html><body><footer><a href="/privacy-policy">Privacy Policy</a></footer></body></html>';
      const findings = runPrivacyPolicyModule(
        makeCrawl({ cleanedHtml: html }),
        makeCtx(),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('INFO');
      expect(findings[0].title).toBe('Privacy policy link observed');
      expect(findings[0].evidence).toContain('footer');
      assertNoAttestationLanguage(findings[0]);
    });

    it('detects a link by href pattern even when text does not match', () => {
      const html =
        '<html><body><a href="/legal/privacy">Read this</a></body></html>';
      const findings = runPrivacyPolicyModule(
        makeCrawl({ cleanedHtml: html }),
        makeCtx(),
      );
      expect(findings[0].title).toBe('Privacy policy link observed');
    });

    it('detects a German Datenschutz anchor', () => {
      const html = '<html><body><a href="/x">Datenschutz</a></body></html>';
      const findings = runPrivacyPolicyModule(
        makeCrawl({ cleanedHtml: html }),
        makeCtx(),
      );
      expect(findings[0].title).toBe('Privacy policy link observed');
    });
  });

  describe('not observed', () => {
    it('emits a LOW signal when no privacy link is found', () => {
      const html = '<html><body><a href="/about">About</a></body></html>';
      const findings = runPrivacyPolicyModule(
        makeCrawl({ cleanedHtml: html }),
        makeCtx(),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('LOW');
      assertNoAttestationLanguage(findings[0]);
    });
  });

  describe('INVARIANT #3 — C1 PII/token leak fixed', () => {
    it('strips query value, email, token and fragment from evidence and location', () => {
      const href = '/privacy-policy?email=a@b.com&token=secret123#frag';
      const html = `<html><body><a href="${href}">Privacy</a></body></html>`;
      const findings = runPrivacyPolicyModule(
        makeCrawl({ cleanedHtml: html, finalUrl: 'https://site.example/' }),
        makeCtx(),
      );
      const f = findings[0];
      const blob = `${f.evidence}\n${f.location}`;
      // Path is preserved
      expect(blob).toContain('/privacy-policy');
      // PII / secrets are NOT present
      expect(blob).not.toContain('a@b.com');
      expect(blob).not.toContain('secret123');
      expect(blob).not.toContain('token=');
      expect(blob).not.toContain('email=');
      expect(blob).not.toContain('#frag');
      expect(blob).not.toContain('?');
    });
  });

  describe('INVARIANT #1 — no outbound network', () => {
    it('does not call global fetch on any path', () => {
      runPrivacyPolicyModule(makeCrawl({ html: '' }), makeCtx());
      runPrivacyPolicyModule(
        makeCrawl({
          cleanedHtml: '<a href="/privacy">Privacy</a>',
        }),
        makeCtx(),
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
