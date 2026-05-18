import * as cheerio from 'cheerio';
import type { CrawlResult, ComplianceContext, RawFinding } from '../types';

/**
 * Strip the query string and fragment from a scanned-site href before it is
 * written into finding.evidence or finding.location. Query strings can carry
 * PII (tokens, email addresses, user IDs) that must not appear in scan output.
 *
 * Strategy: parse with URL() using the page's finalUrl as base so that relative
 * hrefs resolve correctly. Emit only origin + pathname. If parsing fails (truly
 * malformed input), fall back to a simple string-split that removes everything
 * from the first '?' or '#'.
 */
function stripQueryAndFragment(href: string, base: string): string {
  if (!href) return href;
  try {
    const u = new URL(href, base);
    return u.origin + u.pathname;
  } catch {
    // Safe fallback: strip from first '?' or '#', whichever comes first.
    const qi = href.indexOf('?');
    const hi = href.indexOf('#');
    const cut = qi === -1 ? hi : hi === -1 ? qi : Math.min(qi, hi);
    return cut === -1 ? href : href.slice(0, cut);
  }
}

// Anchor text patterns that indicate a privacy policy link.
// Covers English, German (Datenschutz), and Spanish (Privacidad / Política de privacidad).
const PRIVACY_TEXT_RE =
  /privacy|data protection|datenschutz|privacidad|política de privacidad|privacy policy/i;

// href path patterns that strongly indicate a privacy policy destination.
// Deliberately conservative: only well-known canonical slugs, no fuzzy guessing.
const PRIVACY_HREF_PATTERNS = [
  '/privacy',
  '/privacy-policy',
  '/privacy_policy',
  '/legal/privacy',
  '/data-protection',
  '/datenschutz',
];

function hrefMatchesPrivacy(href: string): boolean {
  // Normalise to lowercase path only so we don't FP on query strings or fragment-only links.
  let path: string;
  try {
    // Works for absolute URLs; for relative paths URL() needs a base.
    const url = new URL(href, 'https://x');
    path = url.pathname.toLowerCase();
  } catch {
    path = href.toLowerCase();
  }
  return PRIVACY_HREF_PATTERNS.some(
    (pattern) => path === pattern || path.startsWith(pattern + '/'),
  );
}

/**
 * P5-02 — Privacy Policy Presence
 *
 * Detects whether the crawled HTML contains a link to a privacy policy.
 * Checks anchor text and/or href path. Prominence (footer/nav placement)
 * is noted in the evidence but does not change the finding severity — this
 * module reports observations, not verdicts.
 *
 * Explicitly out of scope (deferred):
 *   - Fetching or inspecting the policy page content (SSRF + scan-budget risk)
 *   - Assessing policy quality or regulatory compliance
 */
export function runPrivacyPolicyModule(
  crawl: CrawlResult,
  ctx: ComplianceContext,
): RawFinding[] {
  // Prefer cleanedHtml (strips script/style noise) > renderedHtml > raw html.
  const htmlSource = crawl.cleanedHtml ?? crawl.renderedHtml ?? crawl.html;

  // FAIL-CLOSED: if there is effectively no DOM we cannot evaluate the signal.
  // Emit a neutral INFO rather than a false-negative signal finding.
  if (!htmlSource || htmlSource.trim().length === 0) {
    return [
      {
        moduleId: 'P5-02',
        severity: 'INFO',
        category: 'Privacy & Compliance',
        title: 'Privacy policy signal not evaluated (no DOM available)',
        location: crawl.finalUrl,
        evidence: 'No HTML was available from the crawl (fetch-only with empty body).',
        explanation:
          'The scanner could not obtain page HTML for this URL, so the presence ' +
          'of a privacy policy link could not be determined.',
        impact: 'No impact assessed — signal not evaluated.',
        fixManual: ['Re-run the scan against a URL that returns an HTML body.'],
        fixAiPrompt: '',
      },
    ];
  }

  // Use the orchestrator-supplied pre-parsed DOM when available to avoid
  // re-parsing the same HTML that other P5 modules have already parsed.
  const $ = ctx.dom ?? cheerio.load(htmlSource);

  // Track the first matching anchor and where in the document it sits.
  let found = false;
  let foundHref = '';
  let foundText = '';
  // Prominence descriptor: footer > nav > other.
  let prominence = 'page body';

  // Walk every anchor element; stop at the first privacy-policy match.
  $('a').each((_i, el) => {
    if (found) return false; // cheerio each — return false to break

    const href = $(el).attr('href') ?? '';
    const text = $(el).text().trim();

    const textMatch = PRIVACY_TEXT_RE.test(text);
    const hrefMatch = hrefMatchesPrivacy(href);

    if (!textMatch && !hrefMatch) return; // not a match, continue

    found = true;
    foundHref = href;
    foundText = text;

    // Determine where in the document the link sits for prominence note.
    // We check closest ancestors in order of specificity.
    const inFooter =
      $(el).closest('footer').length > 0 ||
      $(el).closest('[class*="footer"]').length > 0 ||
      $(el).closest('[id*="footer"]').length > 0;

    const inNav =
      $(el).closest('nav').length > 0 ||
      $(el).closest('[role="navigation"]').length > 0;

    if (inFooter) {
      prominence = 'footer';
    } else if (inNav) {
      prominence = 'navigation';
    }

    return false; // break cheerio each
  });

  if (found) {
    // Strip query string and fragment before writing the href into any finding
    // field — query strings can carry PII (tokens, emails, user IDs).
    const safeHref = stripQueryAndFragment(foundHref, crawl.finalUrl);

    // Observed: emit factual INFO — link was found, no verdict.
    return [
      {
        moduleId: 'P5-02',
        severity: 'INFO',
        category: 'Privacy & Compliance',
        title: 'Privacy policy link observed',
        location: safeHref || crawl.finalUrl,
        evidence:
          `Link text: "${foundText}" | href: "${safeHref}" | ` +
          `Placement: ${prominence}`,
        explanation:
          'A link matching common privacy policy text or URL patterns was found ' +
          `in the page HTML (${prominence}). This is an observation only — the ` +
          'content or adequacy of the linked policy has not been evaluated.',
        impact: 'None from this finding. Policy content quality is not assessed here.',
        fixManual: [],
        fixAiPrompt: '',
      },
    ];
  }

  // Not observed: emit a factual LOW signal.
  // Severity LOW (not MEDIUM) because absence of a detectable link is a signal,
  // not a confirmed violation — the policy may exist at an undetected URL or be
  // linked only from inner pages not crawled.
  return [
    {
      moduleId: 'P5-02',
      severity: 'LOW',
      category: 'Privacy & Compliance',
      title: 'No privacy policy link detected in page HTML',
      location: crawl.finalUrl,
      evidence:
        'No anchor with privacy-related text or href pattern was found in the crawled HTML. ' +
        'Patterns checked: anchor text matching /privacy|data protection|datenschutz|privacidad/i ' +
        'and href paths: /privacy, /privacy-policy, /privacy_policy, /legal/privacy, ' +
        '/data-protection, /datenschutz.',
      explanation:
        'Many data-protection frameworks (GDPR, CCPA, PIPEDA, and others) require that ' +
        'a privacy policy be easily accessible from the site. A link was not found on this ' +
        'page. Note: this is a passive scan of one page; the policy may be linked elsewhere ' +
        'on the site or hosted at a URL this scan did not check.',
      impact:
        'Sites that collect personal data without a clearly linked privacy policy may face ' +
        'regulatory risk depending on applicable law and jurisdiction. Verify whether your ' +
        'site collects data and whether a policy is required.',
      fixManual: [
        'Add a visible link to your privacy policy in the page footer or navigation.',
        'Ensure the link text or href follows common conventions so users and crawlers can locate it.',
        'If your site does not collect personal data, document that fact to reduce regulatory ambiguity.',
      ],
      fixAiPrompt:
        'My website does not appear to have a privacy policy link in its footer or navigation. ' +
        'Help me draft a privacy policy for a web application and add a link to it in my site footer.',
    },
  ];
}
