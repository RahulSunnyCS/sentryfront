export interface ExtensionCookie {
  name: string;
  value: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string | null;
  domain: string | null;
  path: string | null;
}

export interface ExtensionServiceWorkerReg {
  url: string;
  scope: string;
}

export interface ExtensionScanInput {
  url: string;
  html: string;
  headers: Record<string, string>;
  statusCode: number;
  cookies: ExtensionCookie[];
  jsBundleUrls: string[];
  inlineScriptContent: string;
  localStorageData?: Record<string, string>;
  sessionStorageData?: Record<string, string>;
  serviceWorkerRegistrations?: ExtensionServiceWorkerReg[];
}
