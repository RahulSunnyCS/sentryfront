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

export interface CrawlResult {
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  cookies: ParsedCookie[];
  jsBundleUrls: string[];         // absolute URLs of <script src> bundles
  inlineScriptContent: string;    // concatenated inline <script> bodies
  html: string;
  tls: TLSCertInfo | null;
  stack: string;                  // detected framework/host
}
