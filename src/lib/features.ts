/**
 * Phase 6 feature flags — all optional, default to false.
 * 
 * This allows VibeSafe to work as a free, open-source scanner when all
 * monetization features are disabled, or as a full commercial product when enabled.
 */

function parseBool(value: string | undefined, defaultValue = false): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

// ── Feature Flags ────────────────────────────────────────────────────────────

export const features = {
  /** Scan diff comparison endpoint (Pro tier) */
  scanDiff: parseBool(process.env.FEATURE_SCAN_DIFF_ENABLED),

  /** PDF export to Cloudflare R2 */
  pdfExport: parseBool(process.env.PDF_EXPORT_ENABLED),

  /** Stripe payments and subscriptions */
  stripe: parseBool(process.env.STRIPE_ENABLED),

  /** Authentication (Supabase or NextAuth) */
  auth: parseBool(process.env.AUTH_ENABLED),

  /** Tier-based feature gating (requires auth) */
  tierGating: parseBool(process.env.TIER_GATING_ENABLED),
} as const;

// ── Configuration ────────────────────────────────────────────────────────────

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
    scanDiff: { enabled: features.scanDiff, ready: isFeatureReady('scanDiff') },
    pdfExport: { enabled: features.pdfExport, ready: isFeatureReady('pdfExport') },
    stripe: { enabled: features.stripe, ready: isFeatureReady('stripe') },
    auth: { enabled: features.auth, ready: isFeatureReady('auth'), provider: authConfig.provider },
    tierGating: { enabled: features.tierGating, ready: isFeatureReady('tierGating') },
  };
}
