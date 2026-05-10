import { describe, it, expect, beforeEach } from 'vitest';

describe('Features Library', () => {
  beforeEach(() => {
    // Tests run with environment variables already set in vitest.setup.ts
  });

  // parseBool is an internal function, tested through the features object

  describe('Feature flags', () => {
    it('should have scanDiff property', async () => {
      const { features } = await import('@/lib/features');
      expect(features).toHaveProperty('scanDiff');
      expect(typeof features.scanDiff).toBe('boolean');
    });

    it('should have pdfExport property', async () => {
      const { features } = await import('@/lib/features');
      expect(features).toHaveProperty('pdfExport');
      expect(typeof features.pdfExport).toBe('boolean');
    });

    it('should have stripe property', async () => {
      const { features } = await import('@/lib/features');
      expect(features).toHaveProperty('stripe');
      expect(typeof features.stripe).toBe('boolean');
    });

    it('should have auth property', async () => {
      const { features } = await import('@/lib/features');
      expect(features).toHaveProperty('auth');
      expect(typeof features.auth).toBe('boolean');
    });

    it('should have tierGating property', async () => {
      const { features } = await import('@/lib/features');
      expect(features).toHaveProperty('tierGating');
      expect(typeof features.tierGating).toBe('boolean');
    });
  });

  describe('PDF Configuration', () => {
    it('should have pdfConfig object', async () => {
      const { pdfConfig } = await import('@/lib/features');
      expect(pdfConfig).toBeDefined();
      expect(pdfConfig).toHaveProperty('enabled');
      expect(typeof pdfConfig.enabled).toBe('boolean');
    });

    it('should have isConfigured getter', async () => {
      const { pdfConfig } = await import('@/lib/features');
      expect(typeof pdfConfig.isConfigured).toBe('boolean');
    });
  });

  describe('Stripe Configuration', () => {
    it('should have stripeConfig object', async () => {
      const { stripeConfig } = await import('@/lib/features');
      expect(stripeConfig).toBeDefined();
      expect(stripeConfig).toHaveProperty('enabled');
      expect(typeof stripeConfig.enabled).toBe('boolean');
    });

    it('should have isConfigured getter', async () => {
      const { stripeConfig } = await import('@/lib/features');
      expect(typeof stripeConfig.isConfigured).toBe('boolean');
    });
  });

  describe('Auth Configuration', () => {
    it('should have authConfig object', async () => {
      const { authConfig } = await import('@/lib/features');
      expect(authConfig).toBeDefined();
      expect(authConfig).toHaveProperty('enabled');
      expect(typeof authConfig.enabled).toBe('boolean');
    });

    it('should have provider property', async () => {
      const { authConfig } = await import('@/lib/features');
      expect(authConfig).toHaveProperty('provider');
      expect(typeof authConfig.provider).toBe('string');
    });
  });

  describe('isFeatureReady helper', () => {
    it('should be a function', async () => {
      const { isFeatureReady } = await import('@/lib/features');
      expect(typeof isFeatureReady).toBe('function');
    });

    it('should return boolean for valid feature', async () => {
      const { isFeatureReady } = await import('@/lib/features');
      const result = isFeatureReady('auth');
      expect(typeof result).toBe('boolean');
    });

    it('should return boolean for scanDiff feature', async () => {
      const { isFeatureReady } = await import('@/lib/features');
      const result = isFeatureReady('scanDiff');
      expect(typeof result).toBe('boolean');
    });
  });
});
