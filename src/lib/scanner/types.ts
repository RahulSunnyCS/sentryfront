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
}
