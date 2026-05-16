/**
 * Unit tests for audit-parser.ts
 *
 * parseAudit() is a pure function with no external dependencies — no mocks needed.
 * We test every detail type branch and the edge cases in the base fields.
 */
import { describe, it, expect } from 'vitest';
import { parseAudit } from '@/lib/scanner/audit-parser';

describe('parseAudit()', () => {
  // ── Base field handling ───────────────────────────────────────────────────

  describe('base fields', () => {
    it('uses auditId as title fallback when title is absent', () => {
      const result = parseAudit('my-audit-id', { description: 'desc', score: 1 });
      expect(result.title).toBe('my-audit-id');
      expect(result.id).toBe('my-audit-id');
    });

    it('uses the provided title when present', () => {
      const result = parseAudit('my-audit-id', { title: 'My Title', score: 1 });
      expect(result.title).toBe('My Title');
    });

    it('returns score: null when score is null (Lighthouse N/A audits)', () => {
      const result = parseAudit('test', { title: 'T', score: null });
      expect(result.score).toBeNull();
    });

    it('returns score: null when score is undefined (??-null path)', () => {
      const result = parseAudit('test', { title: 'T' });
      expect(result.score).toBeNull();
    });

    it('returns numeric score when present', () => {
      const result = parseAudit('test', { title: 'T', score: 0.75 });
      expect(result.score).toBe(0.75);
    });

    it('returns empty description when description is absent', () => {
      const result = parseAudit('test', { title: 'T', score: 1 });
      expect(result.description).toBe('');
    });

    it('returns type: null when there are no details', () => {
      const result = parseAudit('test', { title: 'T', score: 1 });
      expect(result.type).toBeNull();
    });

    it('returns empty items when there are no details', () => {
      const result = parseAudit('test', { title: 'T', score: 1 });
      expect(result.items).toEqual([]);
    });

    it('passes through displayValue', () => {
      const result = parseAudit('test', {
        title: 'T',
        score: 1,
        displayValue: '3.2 s',
      });
      expect(result.displayValue).toBe('3.2 s');
    });
  });

  // ── overallSavings fields ─────────────────────────────────────────────────

  describe('overallSavings extraction', () => {
    it('extracts overallSavingsBytes from details', () => {
      const result = parseAudit('test', {
        title: 'T',
        score: 0.5,
        details: { type: 'opportunity', items: [], overallSavingsBytes: 12345 },
      });
      expect(result.overallSavingsBytes).toBe(12345);
    });

    it('extracts overallSavingsMs from details', () => {
      const result = parseAudit('test', {
        title: 'T',
        score: 0.5,
        details: { type: 'opportunity', items: [], overallSavingsMs: 420 },
      });
      expect(result.overallSavingsMs).toBe(420);
    });

    it('does not set overallSavingsBytes when absent', () => {
      const result = parseAudit('test', {
        title: 'T',
        score: 1,
        details: { type: 'table', items: [] },
      });
      expect(result.overallSavingsBytes).toBeUndefined();
      expect(result.overallSavingsMs).toBeUndefined();
    });
  });

  // ── opportunity type ──────────────────────────────────────────────────────

  describe('opportunity type', () => {
    it('extracts wastedBytes, wastedMs, wastedPercent, totalBytes and url', () => {
      const result = parseAudit('unused-javascript', {
        title: 'Unused JavaScript',
        score: 0.4,
        details: {
          type: 'opportunity',
          overallSavingsBytes: 50000,
          items: [
            {
              url: 'https://example.com/bundle.js',
              wastedBytes: 40000,
              wastedMs: 800,
              wastedPercent: 80,
              totalBytes: 50000,
            },
          ],
        },
      });

      expect(result.type).toBe('opportunity');
      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.url).toBe('https://example.com/bundle.js');
      expect(item.wastedBytes).toBe(40000);
      expect(item.wastedMs).toBe(800);
      expect(item.wastedPercent).toBe(80);
      expect(item.totalBytes).toBe(50000);
    });

    it('returns empty items when opportunity items array is empty', () => {
      const result = parseAudit('unused-javascript', {
        title: 'T',
        score: 0.5,
        details: { type: 'opportunity', items: [] },
      });
      expect(result.items).toEqual([]);
    });

    it('preserves extra fields on opportunity items not in the known list', () => {
      const result = parseAudit('test', {
        title: 'T',
        score: 0.5,
        details: {
          type: 'opportunity',
          items: [{ url: 'x.js', wastedBytes: 100, customField: 'hello' }],
        },
      });
      // customField should be spread through the ...Object.fromEntries passthrough
      expect((result.items[0] as Record<string, unknown>).customField).toBe('hello');
    });

    it('handles missing items array gracefully (defaults to [])', () => {
      const result = parseAudit('test', {
        title: 'T',
        score: 0.5,
        // items key absent — the default `|| []` path
        details: { type: 'opportunity', overallSavingsBytes: 1000 },
      });
      expect(result.items).toEqual([]);
    });
  });

  // ── table type ────────────────────────────────────────────────────────────

  describe('table type', () => {
    it('extracts url, wastedBytes, wastedMs, totalBytes, label from table items', () => {
      const result = parseAudit('bootup-time', {
        title: 'JavaScript execution time',
        score: 0.6,
        details: {
          type: 'table',
          headings: [{ key: 'url', label: 'Script' }, { key: 'total', label: 'Total CPU' }],
          items: [
            {
              url: 'https://cdn.example.com/vendor.js',
              wastedBytes: 5000,
              wastedMs: 200,
              totalBytes: 80000,
              label: 'Vendor',
            },
          ],
        },
      });

      expect(result.type).toBe('table');
      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.url).toBe('https://cdn.example.com/vendor.js');
      expect(item.wastedBytes).toBe(5000);
      expect(item.wastedMs).toBe(200);
      expect(item.totalBytes).toBe(80000);
      expect(item.label).toBe('Vendor');
    });

    it('includes extra fields from table items not in the known set', () => {
      const result = parseAudit('test', {
        title: 'T',
        score: 0.5,
        details: {
          type: 'table',
          headings: [],
          items: [{ url: 'x.js', scriptParseCompile: 123 }],
        },
      });
      expect((result.items[0] as Record<string, unknown>).scriptParseCompile).toBe(123);
    });

    it('handles items with no url gracefully', () => {
      const result = parseAudit('test', {
        title: 'T',
        score: 0.5,
        details: {
          type: 'table',
          headings: [],
          items: [{ totalBytes: 9999 }],
        },
      });
      expect(result.items[0].url).toBeUndefined();
      expect(result.items[0].totalBytes).toBe(9999);
    });
  });

  // ── list type ─────────────────────────────────────────────────────────────

  describe('list type', () => {
    it('returns list items spread as-is', () => {
      const result = parseAudit('uses-http2', {
        title: 'Serve static assets with an efficient cache policy',
        score: 0.3,
        details: {
          type: 'list',
          items: [
            { text: 'https://example.com/image.png' },
            { text: 'https://example.com/font.woff2' },
          ],
        },
      });
      expect(result.type).toBe('list');
      expect(result.items).toHaveLength(2);
      expect((result.items[0] as Record<string, unknown>).text).toBe(
        'https://example.com/image.png',
      );
    });

    it('handles empty list items', () => {
      const result = parseAudit('test', {
        title: 'T',
        score: 0.5,
        details: { type: 'list', items: [] },
      });
      expect(result.items).toEqual([]);
    });
  });

  // ── debugdata type ────────────────────────────────────────────────────────

  describe('debugdata type', () => {
    it('returns debugdata items spread as-is', () => {
      const result = parseAudit('diagnostics', {
        title: 'Diagnostics',
        score: null,
        details: {
          type: 'debugdata',
          items: [{ numRequests: 42, totalByteWeight: 500000 }],
        },
      });
      expect(result.type).toBe('debugdata');
      expect(result.items).toHaveLength(1);
      expect((result.items[0] as Record<string, unknown>).numRequests).toBe(42);
    });
  });

  // ── treemap-data type ─────────────────────────────────────────────────────

  describe('treemap-data type', () => {
    it('returns empty items for treemap-data (too complex to parse)', () => {
      const result = parseAudit('script-treemap-data', {
        title: 'Script Treemap',
        score: null,
        details: {
          type: 'treemap-data',
          nodes: [{ name: 'vendor.js', resourceBytes: 200000 }],
        },
      });
      expect(result.type).toBe('treemap-data');
      expect(result.items).toEqual([]);
    });
  });

  // ── unknown/default type ──────────────────────────────────────────────────

  describe('unknown details type', () => {
    it('returns items as-is when type is unknown and items is an array', () => {
      const result = parseAudit('test', {
        title: 'T',
        score: 1,
        details: {
          type: 'some-future-type',
          items: [{ foo: 'bar' }],
        },
      });
      expect(result.type).toBe('some-future-type');
      expect(result.items).toHaveLength(1);
      expect((result.items[0] as Record<string, unknown>).foo).toBe('bar');
    });

    it('returns empty items when unknown type has no items array', () => {
      const result = parseAudit('test', {
        title: 'T',
        score: 1,
        details: { type: 'some-future-type', otherData: 'something' },
      });
      expect(result.items).toEqual([]);
    });
  });

  // ── Accessibility audit (node details) ───────────────────────────────────

  describe('accessibility audits with node details', () => {
    it('preserves node.selector and node.snippet when present in table items', () => {
      const result = parseAudit('color-contrast', {
        title: 'Background and foreground colors do not have a sufficient contrast ratio.',
        score: 0,
        details: {
          type: 'table',
          headings: [],
          items: [
            {
              node: {
                selector: 'div.header > span',
                snippet: '<span style="color:#eee">text</span>',
                nodeLabel: 'text',
              },
            },
          ],
        },
      });

      expect(result.items[0].node?.selector).toBe('div.header > span');
      expect(result.items[0].node?.snippet).toBe('<span style="color:#eee">text</span>');
      expect(result.items[0].node?.nodeLabel).toBe('text');
    });
  });
});
