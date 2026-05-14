/**
 * Client-side feature flags for React components.
 * 
 * These are safe to expose to the browser (no secrets).
 * Use NEXT_PUBLIC_ prefix for env vars that need to be available in client components.
 * 
 * For server-side feature checks, use src/lib/features.ts instead.
 */

function parseBool(value: string | undefined, defaultValue = false): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

// ── Client-Safe Feature Flags ────────────────────────────────────────────────

export const clientFeatures = {
  /** Show PDF export button in report UI */
  pdfExport: parseBool(process.env.NEXT_PUBLIC_PDF_EXPORT_ENABLED, true),

  /** Show pricing/payment UI */
  stripe: parseBool(process.env.NEXT_PUBLIC_STRIPE_ENABLED),

  /** Show login/signup UI */
  auth: parseBool(process.env.NEXT_PUBLIC_AUTH_ENABLED),

  /** Show scan diff comparison UI */
  scanDiff: parseBool(process.env.NEXT_PUBLIC_SCAN_DIFF_ENABLED),

  /** Apply tier-based restrictions in UI */
  tierGating: parseBool(process.env.NEXT_PUBLIC_TIER_GATING_ENABLED),
} as const;

// ── Client-Safe Configuration ────────────────────────────────────────────────

export const clientStripeConfig = {
  enabled: clientFeatures.stripe,
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
} as const;

export const clientAuthConfig = {
  enabled: clientFeatures.auth,
  provider: (process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? 'supabase') as 'supabase' | 'nextauth',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
} as const;

// ── React Hooks ──────────────────────────────────────────────────────────────

/**
 * Hook to check if a feature is enabled in the UI.
 * 
 * @example
 * ```tsx
 * function ReportActions() {
 *   const showPdf = useFeature('pdfExport');
 *   const showPayment = useFeature('stripe');
 *   
 *   return (
 *     <>
 *       {showPdf && <PdfExportButton />}
 *       {showPayment && <UpgradeButton />}
 *     </>
 *   );
 * }
 * ```
 */
export function useFeature(feature: keyof typeof clientFeatures): boolean {
  return clientFeatures[feature];
}

/**
 * Get all enabled features (for debugging)
 */
export function getClientEnabledFeatures(): string[] {
  return Object.entries(clientFeatures)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
}
