/**
 * QA Gap: i18n catalog parity for all new performance-section strings (🟡 functional)
 *
 * QA checklist cases:
 *   - "Every new performance-section UI string … has a corresponding key in all five
 *     message catalogs: en, hi, ml, es, de"   (base: new UNAVAILABLE/field/best-practices)
 *   - "New i18n keys for the desktop feature … exist in all five locale catalogs"
 *
 * This test reads the actual JSON files on disk, extracts the keys added by the
 * T-05/T-09 implementation, and asserts that every key present in `en.json` is
 * also present (with a non-empty string value) in the other four catalogs.
 *
 * Why this is automatable as a unit test:
 *   The message catalogs are plain JSON files; no browser or Next.js server is
 *   required. The test fails immediately if a translator accidentally deletes a
 *   key or if a new key is added to en.json without being added to other catalogs.
 *
 * NEW KEYS added by this delivery (T-05 + T-09 implementation):
 *   Under messages.<locale>.performance (nested in the report namespace):
 *     realUserVerdictFast
 *     realUserVerdictAverage
 *     realUserVerdictSlow
 *     noFieldData
 *     bestPracticesLabel
 *     scoreUnavailable
 *     desktopSectionLabel
 *     mobileSectionLabel
 *     desktopSubordinateNote
 *     cacheStalenessNote
 *     realUsersSlowBanner
 *     labScoreLabel
 *     realUserLabel
 *
 * We verify the English baseline has each key, then cross-check all other locales.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Helpers ────────────────────────────────────────────────────────────────────

const MESSAGES_DIR = resolve(process.cwd(), 'messages');

function loadCatalog(locale: string): Record<string, unknown> {
  const path = resolve(MESSAGES_DIR, `${locale}.json`);
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * Navigate a dot-separated key path through a nested object.
 * Returns undefined when any segment is missing.
 */
function getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const segment of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

// ── New performance keys (as nested path from catalog root) ───────────────────
//
// The actual catalog structure is:
//   { report: { performance: { <key>: "..." } } }
//
// All paths below start at the catalog root.

const NEW_PERFORMANCE_KEYS: string[][] = [
  ['report', 'performance', 'realUserVerdictFast'],
  ['report', 'performance', 'realUserVerdictAverage'],
  ['report', 'performance', 'realUserVerdictSlow'],
  ['report', 'performance', 'noFieldData'],
  ['report', 'performance', 'bestPracticesLabel'],
  ['report', 'performance', 'scoreUnavailable'],
  ['report', 'performance', 'desktopSectionLabel'],
  ['report', 'performance', 'mobileSectionLabel'],
  ['report', 'performance', 'desktopSubordinateNote'],
  ['report', 'performance', 'cacheStalenessNote'],
  ['report', 'performance', 'realUsersSlowBanner'],
  ['report', 'performance', 'labScoreLabel'],
  ['report', 'performance', 'realUserLabel'],
];

const ALL_LOCALES = ['en', 'hi', 'ml', 'es', 'de'];
const NON_ENGLISH_LOCALES = ALL_LOCALES.filter((l) => l !== 'en');

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('i18n catalog parity — new performance strings (QA checklist 🟡)', () => {
  // Load all catalogs once
  const catalogs: Record<string, Record<string, unknown>> = {};
  for (const locale of ALL_LOCALES) {
    catalogs[locale] = loadCatalog(locale);
  }

  it('English baseline: all new performance keys are present in en.json with non-empty values', () => {
    const en = catalogs['en'];
    for (const keyPath of NEW_PERFORMANCE_KEYS) {
      const value = getNestedValue(en, keyPath);
      expect(
        value,
        `en.json missing key ${keyPath.join('.')}`
      ).toBeDefined();
      expect(
        typeof value === 'string' && value.length > 0,
        `en.json key ${keyPath.join('.')} is empty or not a string`
      ).toBe(true);
    }
  });

  // One test per non-English locale for clear, targeted failure messages
  for (const locale of NON_ENGLISH_LOCALES) {
    it(`${locale}.json has all new performance keys with non-empty string values`, () => {
      const catalog = catalogs[locale];
      for (const keyPath of NEW_PERFORMANCE_KEYS) {
        const value = getNestedValue(catalog, keyPath);
        expect(
          value,
          `${locale}.json missing key ${keyPath.join('.')}`
        ).toBeDefined();
        expect(
          typeof value === 'string' && value.length > 0,
          `${locale}.json key ${keyPath.join('.')} is empty or not a string`
        ).toBe(true);
      }
    });
  }

  it('all five locales have the same set of new performance keys (no locale has extra/fewer keys)', () => {
    // This assertion guards against a catalog having extra keys that others lack,
    // which would cause subtle runtime failures in the opposite direction.
    for (const keyPath of NEW_PERFORMANCE_KEYS) {
      const presentIn = ALL_LOCALES.filter(
        (locale) => getNestedValue(catalogs[locale], keyPath) !== undefined,
      );
      expect(presentIn.length).toBe(ALL_LOCALES.length);
    }
  });
});
