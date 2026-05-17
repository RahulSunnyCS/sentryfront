/**
 * P5-01 — Cookie Consent Signal
 *
 * Observes whether the page signals the presence of a consent-management
 * platform (CMP). This module emits factual, observable signals — it makes
 * NO compliance verdict and uses NO regulatory-penalty language.
 *
 * Regulation names (GDPR Art. 7, ePrivacy Directive, CCPA) appear only once,
 * as neutral context, to help the reader understand *why* consent tooling is
 * relevant — not as a statement of compliance or non-compliance.
 *
 * FAIL-CLOSED contract (high-risk claim surface):
 *   If the page was not rendered headlessly (renderMode !== 'headless' or no
 *   rendered DOM present), this module emits a single INFO finding saying the
 *   signal could not be evaluated and returns. A negative finding on a
 *   pre-JS fetch-only HTML snapshot would be misleading because consent
 *   banners are almost universally injected by JavaScript after page load.
 */

import * as cheerio from 'cheerio';
import type { CrawlResult, RawFinding, ComplianceContext } from '../types';

// ── CMP detection catalogue ──────────────────────────────────────────────────
//
// Each entry describes one well-known CMP. Detection fires when ANY of the
// following is true for that CMP:
//   - a DOM id/class marker is present in the rendered HTML
//   - a script domain suffix is present in networkRequests or jsBundleUrls
//   - a text marker appears in the rendered HTML (title/banner text)
//
// Adding a new CMP: append an entry; no other code change needed.

interface CmpDescriptor {
  name: string;
  // CSS id/class selectors to check with cheerio. No attribute selectors —
  // just ids and classes, which are fast and stable across CMP versions.
  domIds: string[];
  domClasses: string[];
  // Script hostname suffixes (matched with endsWith). A single entry like
  // 'cdn.cookielaw.org' covers 'cdn.cookielaw.org' exactly.
  scriptDomains: string[];
  // Literal sub-strings to look for in the rendered HTML text. Kept short and
  // specific to avoid false positives on third-party copy that mentions a CMP.
  textMarkers: string[];
}

const CMP_CATALOGUE: CmpDescriptor[] = [
  {
    name: 'OneTrust',
    domIds: ['onetrust-banner-sdk', 'onetrust-accept-btn-handler', 'onetrust-consent-sdk'],
    domClasses: ['onetrust-accept-btn-handler', 'ot-sdk-show-settings'],
    scriptDomains: ['cdn.cookielaw.org', 'optanon.blob.core.windows.net'],
    textMarkers: ['OneTrust', 'optanon'],
  },
  {
    name: 'Cookiebot',
    domIds: ['CybotCookiebotDialog', 'CybotCookiebotDialogBody'],
    domClasses: ['CybotCookiebotDialog', 'CybotCookiebotDialogBodyButton'],
    scriptDomains: ['consent.cookiebot.com'],
    textMarkers: ['Cookiebot', 'CybotCookiebot'],
  },
  {
    name: 'Osano',
    domIds: ['osano-cm-widget', 'osano-cm-info'],
    domClasses: ['osano-cm-widget', 'osano-cm-button'],
    scriptDomains: ['cmp.osano.com'],
    textMarkers: ['Osano'],
  },
  {
    name: 'Termly',
    domIds: ['termly-consent-banner', 'termly-code-snippet-support'],
    domClasses: ['termly-consent-banner'],
    scriptDomains: ['app.termly.io'],
    textMarkers: ['termly'],
  },
  {
    name: 'Usercentrics',
    domIds: ['usercentrics-root', 'usercentrics-cmp'],
    domClasses: ['usercentrics-root'],
    scriptDomains: ['app.usercentrics.eu', 'privacy-proxy.usercentrics.eu'],
    textMarkers: ['Usercentrics'],
  },
  {
    name: 'CookieYes',
    domIds: ['cookie-law-info-bar', 'cky-consent-bar', 'cookieyes-consent-manager'],
    domClasses: ['cky-consent-bar', 'cky-consent-container', 'cookieyes-banner'],
    scriptDomains: ['cdn-cookieyes.com'],
    textMarkers: ['CookieYes', 'cookie-law-info'],
  },
  {
    name: 'Didomi',
    domIds: ['didomi-host', 'didomi-notice', 'didomi-popup'],
    domClasses: ['didomi-popup-notice', 'didomi-consent-popup-surface'],
    scriptDomains: ['sdk.privacy-center.org', 'didomi.io'],
    textMarkers: ['didomi'],
  },
  {
    name: 'Complianz',
    domIds: ['cmplz-cookiebanner', 'cmplz-banner-optin'],
    domClasses: ['cmplz-cookiebanner', 'cmplz-banner-optin'],
    // Complianz is WordPress-hosted; the script domain is the site's own domain,
    // so scriptDomains matching would produce false positives. Omit.
    scriptDomains: [],
    textMarkers: ['complianz', 'cmplz_'],
  },
  {
    name: 'Klaro',
    domIds: ['klaro'],
    domClasses: ['klaro', 'cm-modal'],
    scriptDomains: ['cdn.kiprotect.com'],
    textMarkers: ['klaro'],
  },
  {
    name: 'Quantcast Choice',
    domIds: ['qc-cmp2-ui', 'qc-cmp-ui'],
    domClasses: ['qc-cmp2-main', 'qc-cmp2-ui'],
    scriptDomains: ['quantcast.mgr.consensu.org', 'cmp.quantcast.com'],
    textMarkers: ['QuantcastChoice', 'Quantcast Choice'],
  },
];

// ── Non-essential cookie heuristic ───────────────────────────────────────────
//
// We consider a cookie "likely non-essential" when its name matches common
// patterns for analytics, advertising, personalisation, or session tracking
// by third-party vendors. We deliberately use a conservative allowlist — the
// intent is to surface clear signals, not to flag every unknown cookie.
//
// "Essential" cookies (functional, auth, CSRF, cart, locale) are intentionally
// excluded from this list. This avoids flagging sites that only use necessary
// cookies.

const NON_ESSENTIAL_COOKIE_PATTERNS: RegExp[] = [
  /^_ga/i,           // Google Analytics
  /^_gid/i,          // Google Analytics session id
  /^_gat/i,          // Google Analytics throttle
  /^_fbp/i,          // Facebook Pixel
  /^_fbc/i,          // Facebook click ID
  /^__hstc/i,        // HubSpot tracking
  /^hubspotutk/i,    // HubSpot
  /^__hssc/i,        // HubSpot session
  /^_hjid/i,         // Hotjar visitor id
  /^_hjSession/i,    // Hotjar session
  /^_hjAbsoluteSessionInProgress/i,
  /^mp_/i,           // Mixpanel
  /^ajs_/i,          // Segment analytics.js
  /^intercom-/i,     // Intercom
  /^__utma/i,        // Legacy Google Analytics
  /^__utmb/i,
  /^__utmc/i,
  /^__utmz/i,
  /^OptanonAlertBoxClosed/i,  // OneTrust consent state cookie — if this is
                               // present without a CMP being detected via DOM,
                               // the CMP may have been dismissed before we crawled.
  /^CookieConsent/i, // Cookiebot consent record cookie
  /^cookieyes-consent/i,  // CookieYes consent record
  /^cmplz_/i,        // Complianz consent record
  /^viewed_cookie_policy/i,
  /^cookie_notice_accepted/i,
];

function looksLikeNonEssentialCookie(name: string): boolean {
  return NON_ESSENTIAL_COOKIE_PATTERNS.some((re) => re.test(name));
}

// ── Script domain extraction ──────────────────────────────────────────────────

function scriptHostnames(crawl: CrawlResult): Set<string> {
  const hostnames = new Set<string>();

  // networkRequests covers every request the browser actually made (Playwright path)
  for (const req of crawl.networkRequests ?? []) {
    if (req.resourceType === 'script') {
      try {
        hostnames.add(new URL(req.url).hostname);
      } catch { /* skip malformed URLs */ }
    }
  }

  // jsBundleUrls covers <script src> from the initial HTML (both headless and fetch paths)
  for (const url of crawl.jsBundleUrls) {
    try {
      hostnames.add(new URL(url).hostname);
    } catch { /* skip */ }
  }

  return hostnames;
}

// ── CMP detection ─────────────────────────────────────────────────────────────

interface CmpDetectionResult {
  detected: boolean;
  names: string[];
  method: string; // human-readable summary of how detection fired
}

function detectCmp(dom: string, hostnames: Set<string>): CmpDetectionResult {
  const $ = cheerio.load(dom);
  const detectedNames: string[] = [];
  const methods: string[] = [];

  for (const cmp of CMP_CATALOGUE) {
    let matched = false;
    const matchReasons: string[] = [];

    // 1. DOM id check
    for (const id of cmp.domIds) {
      // cheerio id selector: #id
      if ($(`#${id}`).length > 0) {
        matched = true;
        matchReasons.push(`id #${id}`);
        break;
      }
    }

    // 2. DOM class check (only if not already matched to avoid duplicate noise)
    if (!matched) {
      for (const cls of cmp.domClasses) {
        if ($(`.${cls}`).length > 0) {
          matched = true;
          matchReasons.push(`class .${cls}`);
          break;
        }
      }
    }

    // 3. Script domain check
    if (!matched) {
      for (const domain of cmp.scriptDomains) {
        for (const hostname of hostnames) {
          if (hostname === domain || hostname.endsWith(`.${domain}`)) {
            matched = true;
            matchReasons.push(`script domain ${hostname}`);
            break;
          }
        }
        if (matched) break;
      }
    }

    // 4. Text marker check — search the raw HTML string for speed; cheerio
    //    text extraction would strip attribute values where CMPs often embed
    //    their identifiers.
    if (!matched) {
      for (const marker of cmp.textMarkers) {
        if (dom.includes(marker)) {
          matched = true;
          matchReasons.push(`text marker "${marker}"`);
          break;
        }
      }
    }

    if (matched) {
      detectedNames.push(cmp.name);
      methods.push(`${cmp.name} via ${matchReasons.join(', ')}`);
    }
  }

  return {
    detected: detectedNames.length > 0,
    names: detectedNames,
    method: methods.join('; ') || 'none',
  };
}

// ── Module entry point ────────────────────────────────────────────────────────

const MODULE_ID = 'P5-01';
const CATEGORY = 'Privacy & Compliance';

export function runCookieConsentModule(
  crawl: CrawlResult,
  // ctx is intentionally accepted so the signature is forward-compatible with
  // the compliance module orchestrator — future P5 modules may need ctx fields.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ctx: ComplianceContext,
): RawFinding[] {
  // ── FAIL-CLOSED: no rendered DOM → single INFO, no negative finding ─────────
  //
  // Consent banners are injected by JavaScript after page load. A fetch-only
  // HTML snapshot captures the raw server-sent HTML before any JS executes, so
  // the absence of a CMP marker in that snapshot is meaningless — the banner
  // simply has not been injected yet. Emitting a negative finding here would
  // produce systematic false positives for every JS-rendered consent tool.
  const renderedDom = crawl.cleanedHtml ?? crawl.renderedHtml;
  const isHeadless = crawl.renderMode === 'headless';

  if (!isHeadless || !renderedDom) {
    return [
      {
        moduleId: MODULE_ID,
        severity: 'INFO',
        category: CATEGORY,
        title: 'Cookie consent signal not evaluated (no rendered DOM)',
        location: crawl.finalUrl,
        evidence: `renderMode: ${crawl.renderMode ?? 'unknown'}; renderedHtml present: ${Boolean(crawl.renderedHtml)}`,
        explanation:
          'Cookie consent banners are injected by JavaScript after page load. This page was ' +
          'not crawled in headless mode, so the post-JavaScript DOM is unavailable and the ' +
          'presence or absence of a consent mechanism cannot be determined from the raw HTML.',
        impact:
          'No signal available. Run a headless crawl to evaluate cookie consent tooling.',
        fixManual: [],
        fixAiPrompt: '',
      },
    ];
  }

  // ── Rendered path ─────────────────────────────────────────────────────────
  const findings: RawFinding[] = [];
  const hostnames = scriptHostnames(crawl);
  const cmpResult = detectCmp(renderedDom, hostnames);

  if (cmpResult.detected) {
    // CMP is present — emit a factual INFO observation. No verdict, no score.
    findings.push({
      moduleId: MODULE_ID,
      severity: 'INFO',
      category: CATEGORY,
      title: `Consent mechanism observed: ${cmpResult.names.join(', ')}`,
      location: crawl.finalUrl,
      evidence: `Detected via: ${cmpResult.method}`,
      explanation:
        `The page signals the presence of a consent management platform (${cmpResult.names.join(', ')}). ` +
        'This observation indicates that consent tooling has been deployed; it does not confirm ' +
        'that the implementation satisfies any specific regulatory requirement.',
      impact:
        'Informational. Consent tooling was detected. Configuration and UX correctness ' +
        'require manual review beyond what a passive scan can determine.',
      fixManual: [
        'Verify the CMP is configured to block non-essential scripts before consent is given.',
        'Test the banner across browsers and device types to confirm it renders correctly.',
        'Review your cookie audit to ensure every cookie category is accurately declared.',
      ],
      fixAiPrompt:
        `My site uses ${cmpResult.names.join(' and ')} for cookie consent. ` +
        'Review my CMP configuration and help me confirm that non-essential scripts ' +
        'are blocked before user consent is collected.',
    });
    return findings;
  }

  // ── No CMP detected — check for non-essential cookies ─────────────────────
  //
  // Non-essential cookies present with no CMP is a factual signal worth
  // surfacing. Severity is MEDIUM when analytics/ad cookies are present
  // (common regulatory context: GDPR Art. 7, ePrivacy Directive, CCPA require
  // user consent before setting non-essential cookies in covered jurisdictions)
  // and LOW when only consent-record cookies are present (they could indicate
  // a CMP the scanner did not recognise).
  //
  // We never claim the site IS non-compliant — the finding is a factual
  // observable: non-essential cookies exist and no consent UI was detected.

  const nonEssentialCookies = crawl.cookies.filter((c) => looksLikeNonEssentialCookie(c.name));

  if (nonEssentialCookies.length === 0) {
    // No non-essential cookies detected and no CMP — nothing notable to report.
    return findings;
  }

  // Distinguish between consent-record-only cookies (low signal — CMP may
  // exist but wasn't visible in the DOM snapshot) vs analytics/ad cookies
  // (higher signal — more commonly subject to consent requirements).
  const consentRecordPatterns = [
    /^OptanonAlertBoxClosed/i,
    /^CookieConsent/i,
    /^cookieyes-consent/i,
    /^cmplz_/i,
    /^viewed_cookie_policy/i,
    /^cookie_notice_accepted/i,
  ];
  const isConsentRecordOnly = nonEssentialCookies.every((c) =>
    consentRecordPatterns.some((re) => re.test(c.name)),
  );

  const cookieNames = nonEssentialCookies.map((c) => c.name).join(', ');

  if (isConsentRecordOnly) {
    // These cookies are typically written by CMPs themselves to record consent
    // decisions. Their presence without a visible CMP banner may mean the user
    // already consented in a prior session and the banner was dismissed. Low
    // signal — surface for awareness only.
    findings.push({
      moduleId: MODULE_ID,
      severity: 'LOW',
      category: CATEGORY,
      title: 'Consent-record cookies present; no consent banner detected in rendered page',
      location: crawl.finalUrl,
      evidence: `Cookies: ${cookieNames}`,
      explanation:
        'Cookies that are typically written by consent management platforms to record ' +
        'a user\'s consent decision were observed, but no consent banner or CMP widget ' +
        'was detected in the rendered page. This may indicate that the banner was already ' +
        'dismissed in a prior session, or that the CMP was not recognised by this scanner.',
      impact:
        'Low signal. If a CMP is in use, verify it renders correctly for first-time visitors ' +
        'and that non-essential cookies are not set before consent is given.',
      fixManual: [
        'Open the site in a private/incognito window to verify the consent banner appears on first visit.',
        'Check that non-essential cookies are not set before the user interacts with the banner.',
        'Review your CMP configuration to ensure consent-gating is active for all non-essential cookies.',
      ],
      fixAiPrompt:
        `My site sets consent-record cookies (${cookieNames}) but no consent banner was ` +
        'detected during a headless scan. Help me verify the CMP renders for first-time ' +
        'visitors and that no non-essential cookies are set before consent is collected.',
    });
  } else {
    // Analytics, advertising, or personalisation cookies are present with no
    // CMP detected. Factual signal: these cookie types are commonly subject to
    // consent requirements under GDPR Art. 7, the ePrivacy Directive, and
    // CCPA in covered jurisdictions. We state the observation, not a verdict.
    findings.push({
      moduleId: MODULE_ID,
      severity: 'MEDIUM',
      category: CATEGORY,
      title: 'Non-essential cookies observed; no consent mechanism detected in rendered page',
      location: crawl.finalUrl,
      evidence: `Cookies: ${cookieNames}`,
      explanation:
        'Cookies associated with analytics, advertising, or user-tracking were observed, ' +
        'but no consent management platform (CMP) banner or widget was detected in the ' +
        'post-JavaScript rendered page. As context: regulations such as GDPR Art. 7, the ' +
        'ePrivacy Directive, and CCPA require user consent before setting non-essential ' +
        'cookies in covered jurisdictions. This finding is a factual observation — it does ' +
        'not confirm a compliance violation. A legal assessment requires knowledge of the ' +
        'site\'s jurisdiction, user base, and whether exemptions apply.',
      impact:
        'If this site serves users in a jurisdiction that requires consent for non-essential ' +
        'cookies, the absence of a visible CMP may indicate that consent is not being collected ' +
        'before these cookies are set.',
      fixManual: [
        'Deploy a consent management platform (e.g. OneTrust, Cookiebot, CookieYes, Osano) configured to block non-essential cookies until consent is granted.',
        'Audit all cookies set by your site and classify them (essential vs. non-essential).',
        'Test in an incognito window to confirm no non-essential cookies are set before consent is given.',
        'Consult a legal professional to determine which consent regulations apply to your specific user base and jurisdiction.',
      ],
      fixAiPrompt:
        `My site sets non-essential cookies (${cookieNames}) without an apparent consent ` +
        'mechanism. Help me integrate a consent management platform and configure it to ' +
        'block analytics and advertising scripts until the user provides consent.',
    });
  }

  return findings;
}
