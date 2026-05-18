import { describe, it, expect } from 'vitest';
import { runDomXssModule } from '@/lib/scanner/modules/p1-19-dom-xss';
import type { CrawlResult } from '@/lib/scanner/types';

/**
 * Minimal CrawlResult builder. Only loadedChunkContents varies between tests;
 * all other required fields are fixed stubs so each test stays concise.
 */
function crawl(opts: { chunks?: Record<string, string> }): CrawlResult {
  return {
    finalUrl: 'https://example.com/',
    statusCode: 200,
    headers: {},
    cookies: [],
    jsBundleUrls: [],
    inlineScriptContent: '',
    html: '',
    tls: null,
    stack: '',
    loadedChunkContents: opts.chunks,
  };
}

describe('P1-19 DOM XSS module', () => {
  // ── Graceful no-op paths ────────────────────────────────────────────────────

  describe('graceful no-op when chunk data is absent', () => {
    it('returns [] when loadedChunkContents is undefined', () => {
      expect(runDomXssModule(crawl({}))).toEqual([]);
    });

    it('returns [] when loadedChunkContents is an empty object', () => {
      expect(runDomXssModule(crawl({ chunks: {} }))).toEqual([]);
    });
  });

  // ── Pattern 1: document.write + location ───────────────────────────────────

  describe('Pattern 1 — document.write with location (HIGH)', () => {
    it('flags document.write(location.hash)', () => {
      const findings = runDomXssModule(
        crawl({
          chunks: {
            'https://example.com/bundle.js': `document.write(location.hash)`,
          },
        }),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('HIGH');
      expect(findings[0].confidence).toBe('low');
      expect(findings[0].moduleId).toBe('P1-19');
      expect(findings[0].location).toBe('https://example.com/bundle.js');
      expect(findings[0].evidence).toContain('document.write');
    });

    it('flags document.write(window.location.href)', () => {
      const findings = runDomXssModule(
        crawl({
          chunks: {
            'https://example.com/bundle.js': `document.write(window.location.href)`,
          },
        }),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('HIGH');
    });

    it('does NOT flag generic document.write(variable) without location', () => {
      const findings = runDomXssModule(
        crawl({
          chunks: {
            'https://example.com/bundle.js': `document.write(myVar)`,
          },
        }),
      );
      expect(findings).toHaveLength(0);
    });

    it('does NOT flag assignment TO location (navigation)', () => {
      // window.location.href = '/page' is navigation, not a source-to-sink flow.
      const findings = runDomXssModule(
        crawl({
          chunks: {
            'https://example.com/bundle.js': `window.location.href = '/new-page'; document.write('<p>done</p>')`,
          },
        }),
      );
      // The document.write here has no location source — no finding expected.
      expect(findings).toHaveLength(0);
    });
  });

  // ── Pattern 2: innerHTML + location ────────────────────────────────────────

  describe('Pattern 2 — innerHTML assignment with location (HIGH)', () => {
    it('flags elem.innerHTML = location.hash', () => {
      const findings = runDomXssModule(
        crawl({
          chunks: {
            'https://example.com/app.js': `el.innerHTML = location.hash`,
          },
        }),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('HIGH');
      expect(findings[0].confidence).toBe('low');
    });

    it('flags innerHTML concatenation with location.search', () => {
      const findings = runDomXssModule(
        crawl({
          chunks: {
            'https://example.com/app.js': `div.innerHTML = '<b>' + location.search + '</b>'`,
          },
        }),
      );
      expect(findings).toHaveLength(1);
    });

    it('flags innerHTML using document.referrer', () => {
      const findings = runDomXssModule(
        crawl({
          chunks: {
            'https://example.com/app.js': `el.innerHTML = document.referrer`,
          },
        }),
      );
      expect(findings).toHaveLength(1);
    });

    it('does NOT flag generic innerHTML = variable without location', () => {
      const findings = runDomXssModule(
        crawl({
          chunks: {
            'https://example.com/app.js': `el.innerHTML = sanitize(userInput)`,
          },
        }),
      );
      expect(findings).toHaveLength(0);
    });
  });

  // ── Pattern 3: eval + location ─────────────────────────────────────────────

  describe('Pattern 3 — eval with location (HIGH)', () => {
    it('flags eval(location.hash)', () => {
      const findings = runDomXssModule(
        crawl({
          chunks: {
            'https://example.com/chunk.js': `eval(location.hash)`,
          },
        }),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('HIGH');
    });

    it('flags eval(window.location.search)', () => {
      const findings = runDomXssModule(
        crawl({
          chunks: {
            'https://example.com/chunk.js': `eval(window.location.search)`,
          },
        }),
      );
      expect(findings).toHaveLength(1);
    });

    it('does NOT flag eval(myVar) without location', () => {
      const findings = runDomXssModule(
        crawl({
          chunks: {
            'https://example.com/chunk.js': `eval(myVar)`,
          },
        }),
      );
      expect(findings).toHaveLength(0);
    });
  });

  // ── Pattern 4: setTimeout + location ───────────────────────────────────────

  describe('Pattern 4 — setTimeout with location string (HIGH)', () => {
    it('flags setTimeout(location.hash)', () => {
      const findings = runDomXssModule(
        crawl({
          chunks: {
            'https://example.com/chunk.js': `setTimeout(location.hash, 0)`,
          },
        }),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('HIGH');
    });

    it('flags setTimeout(window.location.search, 100)', () => {
      const findings = runDomXssModule(
        crawl({
          chunks: {
            'https://example.com/chunk.js': `setTimeout(window.location.search, 100)`,
          },
        }),
      );
      expect(findings).toHaveLength(1);
    });

    it('does NOT flag setTimeout(function() {}, 0) without location', () => {
      const findings = runDomXssModule(
        crawl({
          chunks: {
            'https://example.com/chunk.js': `setTimeout(function() { doSomething(); }, 0)`,
          },
        }),
      );
      expect(findings).toHaveLength(0);
    });
  });

  // ── Deduplication: same pattern in one chunk fires only once ───────────────

  describe('deduplication within a chunk', () => {
    it('emits only one finding per pattern per chunk even with multiple occurrences', () => {
      const findings = runDomXssModule(
        crawl({
          chunks: {
            // Two occurrences of Pattern 1 in the same chunk
            'https://example.com/bundle.js': [
              `document.write(location.hash)`,
              `document.write(location.search)`,
            ].join('\n'),
          },
        }),
      );
      // Pattern 1 deduplicates to 1 finding for this chunk.
      expect(findings).toHaveLength(1);
    });
  });

  // ── Cap at 10 total findings ────────────────────────────────────────────────

  describe('finding cap at 10', () => {
    it('returns at most 10 findings across many chunks', () => {
      // Generate 20 distinct chunks, each with a Pattern 1 hit.
      const chunks: Record<string, string> = {};
      for (let i = 0; i < 20; i++) {
        chunks[`https://example.com/chunk-${i}.js`] = `document.write(location.hash)`;
      }
      const findings = runDomXssModule(crawl({ chunks }));
      expect(findings.length).toBeLessThanOrEqual(10);
    });
  });

  // ── Finding shape validation ────────────────────────────────────────────────

  describe('finding field correctness', () => {
    it('populates all required RawFinding fields', () => {
      const findings = runDomXssModule(
        crawl({
          chunks: {
            'https://example.com/app.js': `document.write(location.hash)`,
          },
        }),
      );
      expect(findings).toHaveLength(1);
      const f = findings[0];
      expect(f.moduleId).toBe('P1-19');
      expect(f.severity).toBe('HIGH');
      expect(f.confidence).toBe('low');
      expect(f.category).toBe('Client-Side Security');
      expect(f.title).toBe('Potential DOM-based XSS: unvalidated location used in dangerous sink');
      expect(f.location).toBe('https://example.com/app.js');
      expect(typeof f.evidence).toBe('string');
      expect(f.evidence.length).toBeGreaterThan(0);
      expect(typeof f.explanation).toBe('string');
      expect(f.explanation.length).toBeGreaterThan(0);
      expect(f.impact).toContain('attacker');
      expect(Array.isArray(f.fixManual)).toBe(true);
      expect(f.fixManual.length).toBeGreaterThan(0);
      expect(typeof f.fixAiPrompt).toBe('string');
    });

    it('evidence is trimmed to at most 150 characters plus ellipsis', () => {
      // Pad the chunk with enough surrounding chars to trigger the clip.
      const longPrefix = 'x'.repeat(200);
      const findings = runDomXssModule(
        crawl({
          chunks: {
            'https://example.com/long.js': `${longPrefix}document.write(location.hash)${'y'.repeat(200)}`,
          },
        }),
      );
      expect(findings).toHaveLength(1);
      // After clipping, the evidence should be ≤ 151 chars (150 + "…")
      expect(findings[0].evidence.length).toBeLessThanOrEqual(151);
    });
  });

  // ── Multi-pattern in one chunk fires distinct findings ──────────────────────

  describe('multiple patterns in one chunk', () => {
    it('emits one finding per matching pattern (up to cap)', () => {
      const findings = runDomXssModule(
        crawl({
          chunks: {
            'https://example.com/mixed.js': [
              `document.write(location.hash)`,       // Pattern 1
              `el.innerHTML = location.search`,      // Pattern 2
            ].join('\n'),
          },
        }),
      );
      // Both Pattern 1 and Pattern 2 match — two distinct findings.
      expect(findings).toHaveLength(2);
    });
  });
});
