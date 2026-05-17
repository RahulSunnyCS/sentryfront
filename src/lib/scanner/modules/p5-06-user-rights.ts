/**
 * P5-06 — User Rights Affordances
 *
 * Passive DOM scan for the presence (or absence) of common user-rights
 * affordances: account-deletion, data-export, and Do-Not-Sell links/buttons.
 *
 * This is a heuristic signal only. A finding does NOT constitute a legal
 * opinion or a compliance verdict. Regulation names (GDPR Art. 15-22, CCPA)
 * appear as neutral context so that readers understand why these affordances
 * are relevant — not as a claim that the site is or is not compliant.
 *
 * Design notes:
 * - Pure function: reads crawl.cleanedHtml ?? renderedHtml ?? html; no
 *   outbound requests.
 * - Only emits substantive signals when an auth/account surface is detected.
 *   Informational sites with no account concept are marked N/A (INFO) and
 *   returned immediately — no false positives against static sites.
 * - FAIL-CLOSED: if effectively no DOM is available, emits a single INFO
 *   "not evaluated" finding rather than silently returning [].
 */

import * as cheerio from 'cheerio';
import type { CrawlResult, RawFinding, ComplianceContext } from '../types';

const MODULE_ID = 'P5-06';
const CATEGORY = 'Privacy & Compliance';

// ── Auth/account surface detection ──────────────────────────────────────────

/**
 * Patterns that indicate the page has an account or login surface.
 * We match against anchor/button text and href attributes.
 */
const AUTH_HREF_RE = /login|signin|sign-in|register|signup|sign-up|account/i;
const AUTH_TEXT_RE = /log\s*in|sign\s*in|register|sign\s*up|create\s*account|my\s*account/i;

/** Returns true when the loaded cheerio document shows an account surface. */
function hasAuthSurface($: cheerio.CheerioAPI): boolean {
  // <input type="password"> is the most reliable signal
  if ($('input[type="password"]').length > 0) return true;

  // Anchor hrefs matching auth paths
  let found = false;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (AUTH_HREF_RE.test(href)) {
      found = true;
      return false; // break .each
    }
  });
  if (found) return true;

  // Anchor or button visible text matching auth vocabulary
  $('a, button').each((_, el) => {
    const text = $(el).text().trim();
    if (AUTH_TEXT_RE.test(text)) {
      found = true;
      return false;
    }
  });
  return found;
}

// ── Rights-affordance detection ──────────────────────────────────────────────

/**
 * We look for each affordance in link/button text only (not href paths) so we
 * don't false-positive on URLs like /privacy-policy that mention these topics
 * in the page's meta without surfacing an interactive control.
 */

const DELETE_ACCOUNT_RE = /delete\s+(?:my\s+)?account|close\s+(?:my\s+)?account/i;
const EXPORT_DATA_RE = /download\s+(?:my\s+)?data|export\s+(?:my\s+)?data|data\s+export/i;
// CCPA "Do Not Sell" and its variations (California Consumer Privacy Act, §1798.120)
const DNS_RE =
  /do\s+not\s+sell\s+my\s+(?:personal\s+)?(?:information|data)|your\s+privacy\s+choices|do\s+not\s+share\s+my\s+(?:personal\s+)?(?:information|data)/i;

interface AffordanceCheck {
  key: string;
  re: RegExp;
  title: string;
  explanation: string;
  fixManual: string[];
  fixAiPrompt: string;
}

const AFFORDANCE_CHECKS: AffordanceCheck[] = [
  {
    key: 'deleteAccount',
    re: DELETE_ACCOUNT_RE,
    title: 'Account-deletion affordance not observed in DOM',
    explanation:
      'No "delete account" or "close account" control was detected in the page DOM. ' +
      'GDPR Arts. 17-18 grant users rights to erasure and restriction of processing; ' +
      'many privacy frameworks expect an accessible self-service path. ' +
      'This is a DOM observation — the control may be behind authentication or on a settings page not reached by the crawler.',
    fixManual: [
      'Add a clearly-labelled "Delete my account" button or link in the user settings or profile page.',
      'Ensure the control is reachable without contacting support.',
      'Link to the control from the privacy policy.',
    ],
    fixAiPrompt:
      'My web app does not expose a visible "delete account" control in the crawled DOM. ' +
      'Draft a React settings-page component with a "Delete my account" button that calls DELETE /api/users/me, ' +
      'shows a confirmation dialog, and signs the user out afterward.',
  },
  {
    key: 'exportData',
    re: EXPORT_DATA_RE,
    title: 'Data-export/download affordance not observed in DOM',
    explanation:
      'No "download my data" or "export data" control was detected in the page DOM. ' +
      'GDPR Art. 20 (data portability) and CCPA §1798.100 give users rights to receive ' +
      'a copy of their personal data. ' +
      'This is a DOM observation — the control may be behind authentication or on a settings page not reached by the crawler.',
    fixManual: [
      'Add a "Download my data" button on the user account or settings page.',
      'Generate a JSON or CSV export of the user\'s personal data when requested.',
      'Document the export format and what data is included.',
    ],
    fixAiPrompt:
      'My web app does not expose a visible data-export control in the crawled DOM. ' +
      'Draft a Next.js API route GET /api/users/me/export that queries the database for the authenticated user\'s data and returns it as a downloadable JSON file.',
  },
  {
    key: 'doNotSell',
    re: DNS_RE,
    title: '"Do Not Sell / Share My Personal Information" affordance not observed in DOM',
    explanation:
      'No "Do Not Sell My Personal Information", "Your Privacy Choices", or ' +
      '"Do Not Share My Personal Information" link or button was detected. ' +
      'CCPA §1798.120 requires businesses that sell personal data to California residents ' +
      'to provide a prominent opt-out link. ' +
      'This is a DOM observation — if the site does not sell personal data, this affordance may not be required.',
    fixManual: [
      'If you sell or share personal data, add a "Do Not Sell or Share My Personal Information" link to the site footer.',
      'Link to an opt-out mechanism or privacy preference centre.',
      'Consult legal counsel to confirm whether CCPA obligations apply to your site.',
    ],
    fixAiPrompt:
      'My web app does not expose a "Do Not Sell My Personal Information" or "Your Privacy Choices" link. ' +
      'Draft a footer component and a /privacy-choices page that lets California residents opt out of data sale/sharing, ' +
      'following CCPA §1798.120 requirements.',
  },
];

// ── Module entry point ───────────────────────────────────────────────────────

/**
 * runUserRightsModule scans the crawled DOM for user-rights affordances.
 *
 * @param crawl - The crawl result; uses cleanedHtml ?? renderedHtml ?? html.
 * @param _ctx  - ComplianceContext (received for API consistency; not used in
 *               this module — accessibility score and render mode are not
 *               relevant to DOM-link detection).
 */
export function runUserRightsModule(
  crawl: CrawlResult,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ctx: ComplianceContext,
): RawFinding[] {
  const findings: RawFinding[] = [];

  // Pick the best available DOM representation (cleanedHtml strips scripts /
  // styles so text-matching is less noisy; fall back gracefully).
  const dom = crawl.cleanedHtml ?? crawl.renderedHtml ?? crawl.html ?? '';

  // FAIL-CLOSED: if there is effectively no DOM we cannot evaluate rights
  // affordances and should not emit any substantive findings.
  if (dom.trim().length < 50) {
    findings.push({
      moduleId: MODULE_ID,
      severity: 'INFO',
      category: CATEGORY,
      title: 'User-rights signal not evaluated (no DOM available)',
      location: crawl.finalUrl,
      evidence: `DOM length: ${dom.trim().length} characters`,
      explanation:
        'The crawler could not retrieve enough page content to evaluate user-rights affordances. ' +
        'This finding is informational — it indicates a crawl limitation, not a compliance issue.',
      impact: 'None — evaluation was skipped due to missing content.',
      fixManual: [
        'Verify the target URL is publicly accessible and returns HTML.',
        'Re-run the scan to confirm the result.',
      ],
      fixAiPrompt:
        'The VibeSafe crawler could not retrieve the page DOM for user-rights evaluation. ' +
        'Help me investigate why the page returned minimal content and how to fix it.',
    });
    return findings;
  }

  const $ = cheerio.load(dom);

  // If the page has no account surface, rights affordances are not applicable.
  // Informational sites should not be flagged. Return a single INFO finding.
  if (!hasAuthSurface($)) {
    findings.push({
      moduleId: MODULE_ID,
      severity: 'INFO',
      category: CATEGORY,
      title: 'User-rights affordances: not applicable (no account surface observed)',
      location: crawl.finalUrl,
      evidence:
        'No login/sign-in/register links, forms with password inputs, or account navigation detected.',
      explanation:
        'This page does not appear to have an account or authentication surface. ' +
        'User-rights affordances (delete account, data export, opt-out of data sale) ' +
        'are relevant only for sites that collect personal data under authenticated sessions. ' +
        'If this site does have authenticated areas not reached by the crawler, review manually.',
      impact: 'None — check is not applicable to informational/static sites.',
      fixManual: [],
      fixAiPrompt: '',
    });
    return findings;
  }

  // Auth surface confirmed — check each affordance.
  // Collect all interactive text (anchor and button text) once for efficiency.
  const interactiveTexts: string[] = [];
  $('a, button').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 0) interactiveTexts.push(text);
  });
  const combinedText = interactiveTexts.join('\n');

  for (const check of AFFORDANCE_CHECKS) {
    if (!check.re.test(combinedText)) {
      // Affordance not found — emit a LOW signal. We use LOW (not MEDIUM/HIGH)
      // because absence of a DOM element is a heuristic observation; the
      // control could exist on pages the crawler did not visit (settings,
      // profile, post-login pages). Legal verdicts are outside scope.
      findings.push({
        moduleId: MODULE_ID,
        severity: 'LOW',
        category: CATEGORY,
        title: check.title,
        location: crawl.finalUrl,
        evidence:
          `Auth/account surface was detected (password input or auth link present). ` +
          `No matching control found in ${interactiveTexts.length} scanned link/button text(s).`,
        explanation: check.explanation,
        impact:
          'Users may lack a convenient self-service path to exercise their privacy rights. ' +
          'Absent affordances can increase support burden and regulatory exposure.',
        fixManual: check.fixManual,
        fixAiPrompt: check.fixAiPrompt,
      });
    }
    // Affordance found — no finding emitted. Presence is the expected state;
    // we only signal absence. Emitting a positive "observed" finding would add
    // noise without security value.
  }

  return findings;
}
