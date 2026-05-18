import type { CrawlResult, RawFinding } from '../types';

// Phase P1-19: DOM-based XSS surface detection
//
// DOM XSS occurs when JavaScript reads from a URL-controlled source (location.hash,
// location.search, location.href, document.referrer) and passes it without sanitisation
// to a dangerous sink (document.write, innerHTML, eval, setTimeout with a string arg).
//
// This module detects HIGH-CONFIDENCE source+sink pairs in loaded JS chunks. It does NOT
// flag generic sinks without a confirmed URL-controlled source — that would produce
// far too many false positives on any non-trivial JavaScript bundle.
//
// The module is a no-op when crawl.loadedChunkContents is absent or empty, so
// static-fetch fallback scans are byte-identical to having no module at all
// (same pattern as P1-17 / P1-18).

const MAX_FINDINGS = 10; // Cap total findings to avoid overwhelming reports on heavily bundled apps
const EVIDENCE_MAX = 150; // Code snippet limit: enough to show context without ballooning evidence blobs

/** Trim evidence snippet to a reasonable display length. */
function clip(s: string, n = EVIDENCE_MAX): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/**
 * Each entry describes one source+sink combination the regex detects.
 *
 * Regex design rationale:
 *
 * Pattern 1 — document.write + location:
 *   `document\.write\s*\(\s*(?:window\.)?location\b`
 *   Matches document.write(location or document.write(window.location.
 *   The \b word boundary stops at "location" so it won't fire on variable names
 *   that merely start with "location". Optional `window.` prefix covers both
 *   spellings. The opening paren is required so assignment TO document.write
 *   (which doesn't exist) can't fire.
 *
 * Pattern 2 — innerHTML + location / document.referrer:
 *   `\.innerHTML\s*=\s*[^;\n]{0,80}?(?:location|document\.referrer)\b`
 *   After the `=` we allow up to 80 chars of intervening code (enough for
 *   string concatenation like elem.innerHTML = '<b>' + location.hash + '</b>')
 *   before requiring a location/referrer reference. The 80-char cap prevents
 *   the lazy quantifier from spanning statement boundaries (which would make
 *   it possible to match across two unrelated assignments).
 *
 * Pattern 3 — eval + location:
 *   `\beval\s*\(\s*(?:window\.)?location\b`
 *   Word boundary before eval prevents matching "b64eval(" etc. Requires the
 *   location reference to appear as the first argument (no intervening chars),
 *   which is the most dangerous form and also the highest-confidence shape.
 *
 * Pattern 4 — setTimeout with location as string argument:
 *   `\bsetTimeout\s*\(\s*(?:window\.)?location\b`
 *   setTimeout(locationString) is a code-execution sink when called with a
 *   string. When location.hash etc. is passed as the first arg, this is
 *   effectively eval. Word boundary before setTimeout prevents substring
 *   false matches.
 *
 * All patterns intentionally avoid matching:
 *   - Generic `document.write(variable)` — no confirmed source
 *   - `window.location.href = '/page'` — assignment TO location (navigation),
 *     not FROM location to a sink
 *   - `location.reload()` — method call, no sink involved
 */
const XSS_PATTERNS: Array<{
  regex: RegExp;
  explanation: string;
}> = [
  {
    // P1: document.write with location as the argument source
    regex: /document\.write\s*\(\s*(?:window\.)?location\b/,
    explanation:
      'document.write() with location as source allows URL hash/query parameters to inject arbitrary HTML. Any string in location.hash or location.search that contains HTML tags will be written directly into the DOM, enabling script injection without server interaction.',
  },
  {
    // P2: innerHTML assignment where a location or document.referrer reference
    // appears within 80 chars of the = sign (covers string concatenation cases).
    regex: /\.innerHTML\s*=\s*[^;\n]{0,80}?(?:location|document\.referrer)\b/,
    explanation:
      'innerHTML assignment using location or document.referrer as a data source allows an attacker to craft a URL whose hash, query string, or referrer header injects arbitrary HTML tags, including <script> elements or event handlers.',
  },
  {
    // P3: eval with location as the direct argument (highest-confidence form)
    regex: /\beval\s*\(\s*(?:window\.)?location\b/,
    explanation:
      'eval() with location as its argument executes whatever string the URL hash or query string contains as JavaScript. This is the most direct form of DOM XSS — no HTML parsing is needed; the browser evaluates the attacker-controlled string as code.',
  },
  {
    // P4: setTimeout called with location as a string argument
    regex: /\bsetTimeout\s*\(\s*(?:window\.)?location\b/,
    explanation:
      'setTimeout() called with a location-derived string as its first argument is equivalent to eval() — the browser compiles and executes the string as JavaScript. An attacker can place arbitrary code in the URL hash or query string and have it run in the page context.',
  },
];

// Shared finding fields common to all P1-19 detections.
// Note: we do NOT use `as const` on the whole object because `RawFinding.fixManual`
// expects a mutable string[] — `as const` would infer a readonly tuple that is
// structurally incompatible with the string[] type. Individual literal fields
// that feed a union type (severity, confidence) use inline `as const` casts instead.
const SHARED_FINDING = {
  moduleId: 'P1-19',
  severity: 'HIGH' as const,
  confidence: 'low' as const, // regex heuristic — confirm in code review before treating as exploitable
  category: 'Client-Side Security',
  title: 'Potential DOM-based XSS: unvalidated location used in dangerous sink',
  impact:
    "An attacker can craft a URL with malicious content in the hash or query string, causing script execution in the victim's browser without server interaction.",
  fixManual: [
    'Never pass location.hash, location.search, or location.href directly to document.write(), innerHTML, or eval().',
    'Sanitise URL parameters before inserting into the DOM. Use textContent instead of innerHTML for user-controlled data.',
  ] as string[],
  fixAiPrompt:
    'My JavaScript uses location in a dangerous sink (e.g., document.write(location.hash)). Show me how to safely read URL parameters without XSS risk.',
};

/**
 * Scan each loaded JS chunk for confirmed source+sink DOM XSS patterns.
 *
 * Returns [] immediately when loadedChunkContents is absent or empty,
 * making this a no-op on static-fetch fallback scans.
 *
 * Total findings are capped at MAX_FINDINGS (10) to avoid flooding the
 * findings list on heavily bundled apps where the same pattern repeats
 * across many chunks.
 */
export function runDomXssModule(crawl: CrawlResult): RawFinding[] {
  // Graceful no-op: the static-fetch crawl path does not populate
  // loadedChunkContents, so we must bail without error here.
  const chunks = crawl.loadedChunkContents;
  if (!chunks || Object.keys(chunks).length === 0) return [];

  const findings: RawFinding[] = [];

  for (const [chunkUrl, chunkBody] of Object.entries(chunks)) {
    // Track which pattern indices have already fired for this chunk so we
    // don't emit duplicate findings for multiple occurrences of the same
    // pattern within a single chunk.
    const firedPatternIndices = new Set<number>();

    for (let i = 0; i < XSS_PATTERNS.length; i++) {
      // Stop early if we've already hit the global cap.
      if (findings.length >= MAX_FINDINGS) break;

      // Skip if this pattern already fired for this chunk.
      if (firedPatternIndices.has(i)) continue;

      const { regex, explanation } = XSS_PATTERNS[i];

      // Reset lastIndex — these regexes are not global (/g) so exec always
      // starts from position 0. We use exec (not test) so we can pull the
      // matched string for the evidence field.
      const match = regex.exec(chunkBody);
      if (!match) continue;

      firedPatternIndices.add(i);

      // Extract a snippet around the match for evidence.
      // We take from 20 chars before the match start to keep context, then
      // clip to EVIDENCE_MAX to avoid giant evidence blobs in the report.
      const snippetStart = Math.max(0, match.index - 20);
      const rawSnippet = chunkBody.slice(snippetStart, match.index + match[0].length + 40);
      const evidence = clip(rawSnippet.trim());

      findings.push({
        ...SHARED_FINDING,
        location: chunkUrl,
        evidence,
        explanation,
      });
    }

    if (findings.length >= MAX_FINDINGS) break;
  }

  return findings;
}
