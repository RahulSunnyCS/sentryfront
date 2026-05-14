export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface RawFinding {
  moduleId: string;
  severity: Severity;
  category: string;
  title: string;
  location: string;
  evidence: string;
  explanation: string;
  impact: string;
  fixManual: string[];
  fixAiPrompt: string;

  // Phase 3.3: exploit-intel telemetry. Populated by modules that consult
  // KEV/EPSS (currently P1-16). Absent on findings from legacy modules.
  kevMatch?: boolean;
  epssPercentile?: number | null;

  // Phase 3.7: emission confidence. Populated by 3.11's tunable modules.
  // Absent / null on legacy modules — those bucket as `null` in FP-rate aggregation.
  confidence?: 'high' | 'medium' | 'low';
}

export interface ParsedCookie {
  name: string;
  value: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string | null;
  domain: string | null;
  path: string | null;
}

export interface TLSCertInfo {
  valid: boolean;
  protocol: string | null;
  expiresAt: Date | null;
  daysUntilExpiry: number | null;
  issuer: string | null;
  subject: string | null;
}

export interface NetworkRequest {
  url: string;
  method: string;
  resourceType: string;           // 'document' | 'script' | 'stylesheet' | 'xhr' | 'fetch' | ...
  status: number | null;
  fromCache: boolean;
}

export interface CrawlResult {
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  cookies: ParsedCookie[];
  jsBundleUrls: string[];         // absolute URLs of <script src> bundles in the initial HTML
  inlineScriptContent: string;    // concatenated inline <script> bodies from the initial HTML
  html: string;                   // initial fetched HTML, pre-JS-execution
  tls: TLSCertInfo | null;
  stack: string;                  // detected framework/host

  // Phase 3.1: headless render + chunk coverage. Optional so legacy callers / fallback path work.
  renderedHtml?: string;          // post-JS HTML snapshot from Playwright
  consoleErrors?: string[];       // browser console errors during render
  networkRequests?: NetworkRequest[]; // every request the browser made during render
  loadedChunkContents?: Record<string, string>; // url -> JS body, both browser-loaded and manifest-discovered
  renderMode?: 'headless' | 'fetch-only'; // which path actually ran

  // Phase 3.4: DOM-aware preprocessing for regex modules. cleanedHtml
  // strips HTML comments and the bodies of <script>/<style>/<pre>/<code>/<samp>
  // (opening + closing tags kept so attribute-scanning regexes still match
  // real production markup). Sourced from renderedHtml when present, else html.
  // Modules that opt in read this instead of `html` to suppress docs/blog FPs.
  cleanedHtml?: string;

  // Phase 3.8.4: PWA surface (service workers + web-app manifest). Populated
  // when `features.pwaSurfaceChecks === true`. Modules P1-17 / P1-18 are no-ops
  // when these fields are absent so flag-off output stays byte-identical to pre-3.8.4.
  serviceWorkerRegistrations?: SwRegistrationRecord[];
  serviceWorkerScripts?: Record<string, string>; // SW script URL -> body (capped)
  manifestUrl?: string;                          // resolved href from <link rel="manifest">
  manifestJson?: string;                         // raw manifest body (capped); JSON-parse at the module level
}

export interface SwRegistrationRecord {
  url: string;     // absolute SW script URL
  scope: string;   // declared registration scope (resolved against finalUrl)
}
