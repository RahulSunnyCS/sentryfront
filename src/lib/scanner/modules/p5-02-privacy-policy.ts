import * as cheerio from 'cheerio';
import type { CrawlResult, ComplianceContext, RawFinding } from '../types';

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
  // ctx is accepted for interface consistency with other P5 modules but is not
  // used in this module — this module derives everything from crawled HTML only.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ctx: ComplianceContext,
): RawFinding[] {
  // Prefer cleanedHtml (strips script/style noise) > renderedHtml > raw html.
  const dom = crawl.cleanedHtml ?? crawl.renderedHtml ?? crawl.html;

  // FAIL-CLOSED: if there is effectively no DOM we cannot evaluate the signal.
  // Emit a neutral INFO rather than a false-negative signal finding.
  if (!dom || dom.trim().length === 0) {
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

  const $ = cheerio.load(dom);

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
    // Observed: emit factual INFO — link was found, no verdict.
    return [
      {
        moduleId: 'P5-02',
        severity: 'INFO',
        category: 'Privacy & Compliance',
        title: 'Privacy policy link observed',
        location: foundHref || crawl.finalUrl,
        evidence:
          `Link text: "${foundText}" | href: "${foundHref}" | ` +
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
