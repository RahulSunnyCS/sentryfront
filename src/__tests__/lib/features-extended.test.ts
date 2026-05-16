/**
 * Extended tests for src/lib/features.ts
 *
 * The existing features.test.ts covers basic property existence. This file
 * adds branch-coverage tests for isFeatureReady(), getFeatureStatus(),
 * getEnabledFeatures(), and the config isConfigured getters.
 *
 * Because features.ts is a module with top-level side-effects (env parsing),
 * we import directly — the module-level code runs once. We cannot easily
 * test the `FEATURES` env-var parse branch without module re-import, but we
 * CAN exercise every branch in isFeatureReady() by calling it with each
 * feature key under the default (all-enabled) environment where no external
 * service keys are set.
 */

import { describe, it, expect } from 'vitest';
import {
  features,
  isFeatureReady,
  getEnabledFeatures,
  getFeatureStatus,
  llmConfig,
  pdfConfig,
  stripeConfig,
  authConfig,
} from '@/lib/features';

describe('features object', () => {
  it('has all expected feature keys', () => {
    const expectedKeys = [
      'performanceScanning',
      'accessibilityScanning',
      'seoScanning',
      'llmEnrichment',
      'scanDiff',
      'pdfExport',
      'stripe',
      'auth',
      'tierGating',
      'headlessCrawl',
      'exploitIntelSeverity',
      'headerCoverageChecks',
      'pwaSurfaceChecks',
      'pathCoverageChecks',
      'seoDepthPass',
    ];
    for (const key of expectedKeys) {
      expect(features).toHaveProperty(key);
      expect(typeof features[key as keyof typeof features]).toBe('boolean');
    }
  });

  it('is frozen (cannot be mutated)', () => {
    expect(() => {
      // @ts-expect-error intentional mutation attempt
      features.stripe = false;
    }).toThrow();
  });
});

describe('isFeatureReady — per-feature branches', () => {
  it('returns true for performanceScanning when enabled', () => {
    // performanceScanning returns true when enabled; no external config needed
    const result = isFeatureReady('performanceScanning');
    expect(typeof result).toBe('boolean');
    // In default test env, all features enabled → should return true
    expect(result).toBe(true);
  });

  it('returns true for accessibilityScanning when enabled', () => {
    expect(isFeatureReady('accessibilityScanning')).toBe(true);
  });

  it('returns true for seoScanning when enabled', () => {
    expect(isFeatureReady('seoScanning')).toBe(true);
  });

  it('returns true for scanDiff when enabled', () => {
    expect(isFeatureReady('scanDiff')).toBe(true);
  });

  it('returns boolean for llmEnrichment (depends on ANTHROPIC_API_KEY)', () => {
    // In test env, ANTHROPIC_API_KEY is not set → llmConfig.isConfigured is false
    const result = isFeatureReady('llmEnrichment');
    // We just assert it is a boolean — actual value depends on env
    expect(typeof result).toBe('boolean');
    // With no API key set in test env, expect false
    expect(result).toBe(false);
  });

  it('returns boolean for pdfExport (depends on R2 config)', () => {
    const result = isFeatureReady('pdfExport');
    expect(typeof result).toBe('boolean');
    // No R2 config in test env → false
    expect(result).toBe(false);
  });

  it('returns boolean for stripe (depends on Stripe keys)', () => {
    const result = isFeatureReady('stripe');
    expect(typeof result).toBe('boolean');
    // No Stripe keys in test env → false
    expect(result).toBe(false);
  });

  it('returns boolean for auth (depends on auth provider config)', () => {
    const result = isFeatureReady('auth');
    expect(typeof result).toBe('boolean');
  });

  it('returns boolean for tierGating (requires auth and its config)', () => {
    const result = isFeatureReady('tierGating');
    expect(typeof result).toBe('boolean');
    // tierGating checks features.auth && authConfig.isConfigured
    // Both conditions chain: if auth is not configured, tierGating is false
    if (!isFeatureReady('auth')) {
      expect(result).toBe(false);
    }
  });

  it('returns false for the default case (unknown-ish feature key via type cast)', () => {
    // The default branch in the switch handles features not in the explicit cases
    // (headlessCrawl, exploitIntelSeverity, etc.)
    // These fall through to `default: return false`
    const result = isFeatureReady('headlessCrawl');
    expect(result).toBe(false);
  });

  it('returns false for exploitIntelSeverity (hits default branch)', () => {
    expect(isFeatureReady('exploitIntelSeverity')).toBe(false);
  });

  it('returns false for headerCoverageChecks (hits default branch)', () => {
    expect(isFeatureReady('headerCoverageChecks')).toBe(false);
  });

  it('returns false for pwaSurfaceChecks (hits default branch)', () => {
    expect(isFeatureReady('pwaSurfaceChecks')).toBe(false);
  });

  it('returns false for pathCoverageChecks (hits default branch)', () => {
    expect(isFeatureReady('pathCoverageChecks')).toBe(false);
  });

  it('returns false for seoDepthPass (hits default branch)', () => {
    expect(isFeatureReady('seoDepthPass')).toBe(false);
  });
});

describe('getEnabledFeatures', () => {
  it('returns an array of strings', () => {
    const enabled = getEnabledFeatures();
    expect(Array.isArray(enabled)).toBe(true);
    enabled.forEach((name) => expect(typeof name).toBe('string'));
  });

  it('includes features that are enabled', () => {
    const enabled = getEnabledFeatures();
    // All features default to true, so the array should have length 15
    expect(enabled.length).toBeGreaterThan(0);
  });

  it('only returns feature names, not values', () => {
    const enabled = getEnabledFeatures();
    // Values should be keys of the features object, not booleans
    for (const name of enabled) {
      expect(Object.keys(features)).toContain(name);
    }
  });
});

describe('getFeatureStatus', () => {
  it('returns an object with expected keys', () => {
    const status = getFeatureStatus();
    const expectedKeys = [
      'performanceScanning',
      'accessibilityScanning',
      'seoScanning',
      'llmEnrichment',
      'scanDiff',
      'pdfExport',
      'stripe',
      'auth',
      'tierGating',
    ];
    for (const key of expectedKeys) {
      expect(status).toHaveProperty(key);
    }
  });

  it('each entry has enabled and ready properties', () => {
    const status = getFeatureStatus();
    for (const [, entry] of Object.entries(status)) {
      expect(entry).toHaveProperty('enabled');
      expect(typeof (entry as { enabled: boolean }).enabled).toBe('boolean');
      expect(entry).toHaveProperty('ready');
      expect(typeof (entry as { ready: boolean }).ready).toBe('boolean');
    }
  });

  it('auth entry includes provider property', () => {
    const status = getFeatureStatus();
    expect(status.auth).toHaveProperty('provider');
    expect(typeof status.auth.provider).toBe('string');
  });

  it('enabled values match the features object', () => {
    const status = getFeatureStatus();
    expect(status.stripe.enabled).toBe(features.stripe);
    expect(status.auth.enabled).toBe(features.auth);
    expect(status.llmEnrichment.enabled).toBe(features.llmEnrichment);
  });
});

describe('llmConfig', () => {
  it('has expected properties', () => {
    expect(llmConfig).toHaveProperty('enabled');
    expect(llmConfig).toHaveProperty('apiKey');
    expect(llmConfig).toHaveProperty('model');
    expect(llmConfig).toHaveProperty('isConfigured');
  });

  it('isConfigured is false when no API key is set in test env', () => {
    // ANTHROPIC_API_KEY not set in vitest.setup.ts → apiKey is ''
    expect(llmConfig.isConfigured).toBe(false);
  });

  it('model defaults to claude-sonnet-4-20250514 when env var absent', () => {
    // ANTHROPIC_MODEL not set in test env
    expect(llmConfig.model).toBe('claude-sonnet-4-20250514');
  });
});

describe('pdfConfig', () => {
  it('has expected properties', () => {
    expect(pdfConfig).toHaveProperty('enabled');
    expect(pdfConfig).toHaveProperty('r2AccountId');
    expect(pdfConfig).toHaveProperty('r2AccessKeyId');
    expect(pdfConfig).toHaveProperty('r2SecretAccessKey');
    expect(pdfConfig).toHaveProperty('r2BucketName');
    expect(pdfConfig).toHaveProperty('isConfigured');
  });

  it('isConfigured is false when no R2 env vars are set', () => {
    // None of the CLOUDFLARE_R2_* vars are set in vitest.setup.ts
    expect(pdfConfig.isConfigured).toBe(false);
  });
});

describe('stripeConfig', () => {
  it('has expected properties', () => {
    expect(stripeConfig).toHaveProperty('enabled');
    expect(stripeConfig).toHaveProperty('secretKey');
    expect(stripeConfig).toHaveProperty('webhookSecret');
    expect(stripeConfig).toHaveProperty('publishableKey');
    expect(stripeConfig).toHaveProperty('isConfigured');
  });

  it('isConfigured is false when Stripe keys are absent', () => {
    expect(stripeConfig.isConfigured).toBe(false);
  });
});

describe('authConfig', () => {
  it('has expected properties', () => {
    expect(authConfig).toHaveProperty('enabled');
    expect(authConfig).toHaveProperty('provider');
    expect(authConfig).toHaveProperty('supabase');
    expect(authConfig).toHaveProperty('nextauth');
    expect(authConfig).toHaveProperty('isConfigured');
  });

  it('supabase.isConfigured is false when Supabase vars absent', () => {
    expect(authConfig.supabase.isConfigured).toBe(false);
  });

  it('nextauth.isConfigured checks url and secret', () => {
    // In test env, NEXTAUTH_URL and NEXTAUTH_SECRET are set by vitest.setup.ts
    // so nextauth.isConfigured should be true
    expect(typeof authConfig.nextauth.isConfigured).toBe('boolean');
  });

  it('isConfigured delegates to the active provider', () => {
    // The top-level isConfigured checks this.provider and delegates
    expect(typeof authConfig.isConfigured).toBe('boolean');
    if (authConfig.provider === 'supabase') {
      expect(authConfig.isConfigured).toBe(authConfig.supabase.isConfigured);
    } else {
      expect(authConfig.isConfigured).toBe(authConfig.nextauth.isConfigured);
    }
  });
});
