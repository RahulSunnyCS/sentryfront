/**
 * Unit tests for P5-06 — User Rights Affordances.
 *
 * Covers: happy path (affordances present → no findings), edge cases (no DOM,
 * no account surface, missing affordances), and the mandatory invariants:
 *  - INVARIANT #1: no outbound network (pure function)
 *  - INVARIANT #2: fail-closed — no DOM → neutral INFO (never a negative verdict)
 *  - INVARIANT #4: no numeric score / no attestation vocabulary
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runUserRightsModule } from '@/lib/scanner/modules/p5-06-user-rights';
import { makeCrawl, makeCtx, assertNoAttestationLanguage } from './p5-test-helpers';

describe('P5-06 user rights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fail-closed (INVARIANT #2)', () => {
    it('emits a single neutral INFO when DOM is effectively empty', () => {
      const findings = runUserRightsModule(
        makeCrawl({ renderMode: 'fetch-only', html: '' }),
        makeCtx(),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('INFO');
      expect(findings[0].title.toLowerCase()).toContain('not evaluated');
    });

    it('emits INFO (never LOW) when DOM is below the minimum length threshold', () => {
      const findings = runUserRightsModule(
        makeCrawl({ html: '<html></html>' }),
        makeCtx(),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('INFO');
      expect(findings[0].severity).not.toBe('LOW');
    });
  });

  describe('no account surface', () => {
    it('emits a single "not applicable" INFO for an informational site', () => {
      const html =
        '<html><body><main>' +
        'Welcome to our informational marketing site with lots of content here. ' +
        '</main><footer>Contact us</footer></body></html>';
      const findings = runUserRightsModule(
        makeCrawl({ cleanedHtml: html }),
        makeCtx(),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('INFO');
      expect(findings[0].title.toLowerCase()).toContain('not applicable');
      assertNoAttestationLanguage(findings[0]);
    });
  });

  describe('account surface present', () => {
    it('emits LOW findings for each missing rights affordance', () => {
      const html =
        '<html><body>' +
        '<a href="/login">Log in</a>' +
        '<input type="password" />' +
        '<a href="/about">About this product and service offering page</a>' +
        '</body></html>';
      const findings = runUserRightsModule(
        makeCrawl({ cleanedHtml: html }),
        makeCtx(),
      );
      // delete account, export data, do-not-sell all absent
      expect(findings).toHaveLength(3);
      for (const f of findings) {
        expect(f.severity).toBe('LOW');
        assertNoAttestationLanguage(f);
      }
    });

    it('does not flag an affordance that is present in the DOM', () => {
      const html =
        '<html><body>' +
        '<a href="/login">Sign in</a>' +
        '<button>Delete my account</button>' +
        '<button>Download my data</button>' +
        '<a href="/x">Do Not Sell My Personal Information</a>' +
        '</body></html>';
      const findings = runUserRightsModule(
        makeCrawl({ cleanedHtml: html }),
        makeCtx(),
      );
      expect(findings).toEqual([]);
    });
  });

  describe('INVARIANT #1 — no outbound network', () => {
    it('does not call global fetch on any path', () => {
      runUserRightsModule(makeCrawl({ html: '' }), makeCtx());
      runUserRightsModule(
        makeCrawl({
          cleanedHtml:
            '<a href="/login">Log in</a><input type="password"/><p>content padding here for length</p>',
        }),
        makeCtx(),
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
