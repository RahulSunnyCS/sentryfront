/**
 * Feature Flags — Configure via FEATURES environment variable
 *
 * All features enabled by default. Override by setting FEATURES env variable.
 *
 * Format: FEATURES='{"stripe":false,"auth":false,"tierGating":false}'
 *
 * This allows VibeSafe to work as a complete platform by default,
 * with selective feature disabling when needed.
 */

// Default feature configuration (all enabled, except desktopPerformance which is opt-in)
const defaultFeatures = {
  performanceScanning: true,
  accessibilityScanning: true,
  seoScanning: true,
  llmEnrichment: true,
  scanDiff: true,
  pdfExport: true,
  stripe: true,
  auth: true,
  tierGating: true,
  headlessCrawl: true,
  exploitIntelSeverity: true,
  headerCoverageChecks: true,
  pwaSurfaceChecks: true,
  pathCoverageChecks: true,
  seoDepthPass: true,
  // Desktop performance measurement is off by default because each scan that enables it
  // consumes two PageSpeed API quota slots (one mobile + one desktop) instead of one.
  // Operators must explicitly opt in via FEATURES='{"desktopPerformance":true}'.
  desktopPerformance: false,
  // Compliance scanning (Phase 5): cookie consent, privacy policy, data-protection
  // headers, WCAG attestation, third-party data sharing, and user-rights signals.
  // On by default — flag-off behaviour is byte-identical to pre-Phase-5 because no
  // P5 module is wired into scanner/index.ts until the wiring task runs.
  complianceScanning: true,
};

// Parse FEATURES env variable (JSON object)
let customFeatures: Partial<typeof defaultFeatures> = {};
try {
  if (process.env.FEATURES) {
    customFeatures = JSON.parse(process.env.FEATURES);
  }
} catch (error) {
  console.warn('Invalid FEATURES env variable, using defaults:', error);
}

// ── Feature Flags ────────────────────────────────────────────────────────────

export const features = {
  /** Performance scanning (Phase 5.5) — Lighthouse Core Web Vitals analysis */
  performanceScanning: customFeatures.performanceScanning ?? defaultFeatures.performanceScanning,

  /** Accessibility scanning (Phase 6.5) — WCAG 2.2 Level AA compliance */
  accessibilityScanning: customFeatures.accessibilityScanning ?? defaultFeatures.accessibilityScanning,

  /** SEO scanning (Phase 7.5) — Search engine optimization analysis */
  seoScanning: customFeatures.seoScanning ?? defaultFeatures.seoScanning,

  /** LLM enrichment (Phase 5) — AI-powered finding explanations via Anthropic */
  llmEnrichment: customFeatures.llmEnrichment ?? defaultFeatures.llmEnrichment,

  /** Scan diff comparison endpoint (Pro tier) */
  scanDiff: customFeatures.scanDiff ?? defaultFeatures.scanDiff,

  /** PDF export */
  pdfExport: customFeatures.pdfExport ?? defaultFeatures.pdfExport,

  /** Stripe payments and subscriptions */
  stripe: customFeatures.stripe ?? defaultFeatures.stripe,

  /** Authentication (Supabase or NextAuth) */
  auth: customFeatures.auth ?? defaultFeatures.auth,

  /** Tier-based feature gating (requires auth) */
  tierGating: customFeatures.tierGating ?? defaultFeatures.tierGating,

  /** Phase 3.1: headless-rendered crawl via Playwright. Falls back to static fetch on failure. */
  headlessCrawl: customFeatures.headlessCrawl ?? defaultFeatures.headlessCrawl,

  /** Phase 3.3: KEV + EPSS exploit-intel severity tiering for client-side CVE findings. */
  exploitIntelSeverity: customFeatures.exploitIntelSeverity ?? defaultFeatures.exploitIntelSeverity,

  /** Phase 3.8: coverage-gap header checks — SRI on external scripts, COOP/COEP presence,
   *  Permissions-Policy + Referrer-Policy value sanity. CSP/HSTS/XFO/XCTO presence checks
   *  always run regardless of this flag. */
  headerCoverageChecks: customFeatures.headerCoverageChecks ?? defaultFeatures.headerCoverageChecks,

  /** Phase 3.8.4: PWA surface checks — service-worker security (P1-17) + web-app
   *  manifest exposure (P1-18). When off, the crawler skips SW registration capture
   *  and manifest fetch entirely; flag-off CrawlResult is byte-identical to pre-3.8.4. */
  pwaSurfaceChecks: customFeatures.pwaSurfaceChecks ?? defaultFeatures.pwaSurfaceChecks,

  /** Phase 3.8.2: coverage-gap path probes — VCS metadata (.git/index, .svn/wc.db, .hg/store),
   *  OS/editor metadata (.DS_Store, Thumbs.db), backup variants (.bak/.old/.swp), and dependency
   *  lockfiles (yarn.lock, package-lock.json, Gemfile.lock). The original 32-path probe always runs
   *  regardless of this flag. */
  pathCoverageChecks: customFeatures.pathCoverageChecks ?? defaultFeatures.pathCoverageChecks,

  /** Phase 3.11: SEO + AI-discoverability depth pass — in-house parsing of
   *  viewport/lang/canonical-chain, og:image reachability, Schema.org
   *  required-field validation, hreflang surfacing, sitemap structural
   *  validity, llms.txt + AI-crawler robots policy + rendered/initial content
   *  diff. Cross-source corroborated. When off, only the legacy Lighthouse-
   *  derived SEO findings emit, so flag-off output is byte-identical to pre-3.11. */
  seoDepthPass: customFeatures.seoDepthPass ?? defaultFeatures.seoDepthPass,

  /** Desktop performance measurement — when true, Lighthouse/PageSpeed runs an
   *  additional desktop pass alongside the default mobile pass. Defaults to
   *  false because it doubles PageSpeed API quota usage (mobile + desktop per
   *  scan). When false, only the mobile-form-factor pass runs, so scanner
   *  output is byte-identical to today. Enable via
   *  FEATURES='{"desktopPerformance":true}'. */
  desktopPerformance: customFeatures.desktopPerformance ?? defaultFeatures.desktopPerformance,

  /** Compliance scanning (Phase 5) — cookie consent, privacy policy, data-protection
   *  headers, WCAG attestation, third-party data sharing, and user-rights signals.
   *  Defaults to true; when off, no P5 modules run and scanner output is
   *  byte-identical to pre-Phase-5 (no runtime wiring exists yet). */
  complianceScanning: customFeatures.complianceScanning ?? defaultFeatures.complianceScanning,
} as const;

// ── Configuration ────────────────────────────────────────────────────────────

export const llmConfig = {
  enabled: features.llmEnrichment,
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
  get isConfigured(): boolean {
    return !!this.apiKey;
  },
} as const;

export const pdfConfig = {
  enabled: features.pdfExport,
  r2AccountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID ?? '',
  r2AccessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? '',
  r2SecretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? '',
  r2BucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME ?? '',
  get isConfigured(): boolean {
    return !!(this.r2AccountId && this.r2AccessKeyId && this.r2SecretAccessKey && this.r2BucketName);
  },
} as const;

export const stripeConfig = {
  enabled: features.stripe,
  secretKey: process.env.STRIPE_SECRET_KEY ?? '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
  get isConfigured(): boolean {
    return !!(this.secretKey && this.webhookSecret);
  },
} as const;

export const authConfig = {
  enabled: features.auth,
  provider: (process.env.AUTH_PROVIDER ?? 'supabase') as 'supabase' | 'nextauth',
  
  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    anonKey: process.env.SUPABASE_ANON_KEY ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    get isConfigured(): boolean {
      return !!(this.url && this.anonKey && this.serviceRoleKey);
    },
  },
  
  // NextAuth
  nextauth: {
    url: process.env.NEXTAUTH_URL ?? '',
    secret: process.env.NEXTAUTH_SECRET ?? '',
    github: {
      id: process.env.GITHUB_ID ?? '',
      secret: process.env.GITHUB_SECRET ?? '',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
    get isConfigured(): boolean {
      return !!(this.url && this.secret);
    },
  },
  
  get isConfigured(): boolean {
    return this.provider === 'supabase' 
      ? this.supabase.isConfigured 
      : this.nextauth.isConfigured;
  },
} as const;

// ── Validation Helpers ───────────────────────────────────────────────────────

/**
 * Check if a feature is both enabled and properly configured.
 * Use this before attempting to use feature-specific functionality.
 */
export function isFeatureReady(feature: keyof typeof features): boolean {
  if (!features[feature]) return false;

  switch (feature) {
    case 'performanceScanning':
      // Performance scanning just needs to be enabled, uses Lighthouse (no external config)
      return true;
    case 'accessibilityScanning':
      // Accessibility scanning just needs to be enabled, uses Lighthouse (no external config)
      return true;
    case 'seoScanning':
      // SEO scanning just needs to be enabled, uses Lighthouse (no external config)
      return true;
    case 'llmEnrichment':
      return llmConfig.isConfigured;
    case 'pdfExport':
      return pdfConfig.isConfigured;
    case 'stripe':
      return stripeConfig.isConfigured;
    case 'auth':
      return authConfig.isConfigured;
    case 'tierGating':
      // Tier gating requires auth to be enabled and configured
      return features.auth && authConfig.isConfigured;
    case 'scanDiff':
      // Scan diff just needs to be enabled, no external config
      return true;
    case 'desktopPerformance':
      // Desktop performance needs no external config beyond the flag itself;
      // "ready" simply mirrors the enabled boolean, same as performanceScanning.
      return true;
    case 'complianceScanning':
      // Compliance scanning needs no external config beyond the flag itself;
      // ready mirrors enabled, same pattern as seoScanning.
      return true;
    default:
      return false;
  }
}

/**
 * Get a list of all enabled features (for debugging/health checks)
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(features)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
}

/**
 * Get feature status report (for admin dashboard or health endpoint)
 */
export function getFeatureStatus() {
  return {
    performanceScanning: { enabled: features.performanceScanning, ready: isFeatureReady('performanceScanning') },
    accessibilityScanning: { enabled: features.accessibilityScanning, ready: isFeatureReady('accessibilityScanning') },
    seoScanning: { enabled: features.seoScanning, ready: isFeatureReady('seoScanning') },
    llmEnrichment: { enabled: features.llmEnrichment, ready: isFeatureReady('llmEnrichment') },
    scanDiff: { enabled: features.scanDiff, ready: isFeatureReady('scanDiff') },
    pdfExport: { enabled: features.pdfExport, ready: isFeatureReady('pdfExport') },
    stripe: { enabled: features.stripe, ready: isFeatureReady('stripe') },
    auth: { enabled: features.auth, ready: isFeatureReady('auth'), provider: authConfig.provider },
    tierGating: { enabled: features.tierGating, ready: isFeatureReady('tierGating') },
    desktopPerformance: { enabled: features.desktopPerformance, ready: isFeatureReady('desktopPerformance') },
    complianceScanning: { enabled: features.complianceScanning, ready: isFeatureReady('complianceScanning') },
  };
}
