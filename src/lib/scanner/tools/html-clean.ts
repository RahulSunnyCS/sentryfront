// Phase 3.4 — DOM-aware preprocessing for regex modules.
//
// Several P1 modules match against raw HTML with regexes. The audit found
// five FP traps with a single root cause: regexes fire on docs/blog/example
// content sitting inside HTML comments, <script> string literals, or
// <pre>/<code>/<samp> blocks — content the browser never renders as markup.
//
// cleanHtml() returns a copy of the input with those regions zeroed out
// while keeping the tags themselves (and their attributes) intact, so a
// module like P1-08 can still detect `<script src="http://...">` opening
// tags but won't fire on a docs page that displays the same string inside
// a <code> block.

const COMMENT_RE = /<!--[\s\S]*?-->/g;

// Tags whose body content is either raw text (script/style) or
// human-facing example markup (pre/code/samp). We replace the body with
// an empty string but preserve the opening + closing tag, so attribute-
// scanning regexes (e.g. P1-08's `<script[^>]+src=`) still match the
// production case but stop firing on rendered example text.
const BODY_STRIP_TAGS = ['script', 'style', 'pre', 'code', 'samp'] as const;

export interface CleanHtmlOptions {
  // Soft cap on input length. Above this, cleaning is skipped and the
  // original string is returned. Prevents pathological regex cost on
  // multi-megabyte pages while still being a no-op for typical sites.
  maxInputBytes?: number;
  // If cleaning collapses the page to a tiny fraction of its original
  // size, treat that as a parser failure and fall back to the original
  // HTML rather than letting modules scan an empty string. Disabled by
  // setting to 0.
  minRetainedFraction?: number;
}

const DEFAULT_OPTIONS: Required<CleanHtmlOptions> = {
  maxInputBytes: 5_000_000, // 5 MB — bigger than any real page we crawl
  minRetainedFraction: 0.1,
};

export function cleanHtml(html: string, opts: CleanHtmlOptions = {}): string {
  if (!html) return html;
  const { maxInputBytes, minRetainedFraction } = { ...DEFAULT_OPTIONS, ...opts };

  if (html.length > maxInputBytes) return html;

  let out = html.replace(COMMENT_RE, '');

  for (const tag of BODY_STRIP_TAGS) {
    // (<tag ...>) BODY (</tag ...>) → keep $1 + $2
    // Non-greedy body match; case-insensitive; `s`-like across newlines via [\s\S].
    const re = new RegExp(`(<${tag}\\b[^>]*>)[\\s\\S]*?(<\\/${tag}\\s*>)`, 'gi');
    out = out.replace(re, '$1$2');
  }

  if (
    minRetainedFraction > 0 &&
    html.length > 200 &&
    out.length < html.length * minRetainedFraction
  ) {
    return html;
  }

  return out;
}
