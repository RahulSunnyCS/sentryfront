import { describe, it, expect } from 'vitest';
import { runTLSModule } from '@/lib/scanner/modules/p1-04-tls';
import type { CrawlResult } from '@/lib/scanner/types';

const createCrawlResult = (
  finalUrl: string,
  tls?: CrawlResult['tls']
): CrawlResult => ({
  finalUrl,
  html: '',
  headers: {},
  cookies: [],
  localStorage: {},
  sessionStorage: {},
  scripts: [],
  links: [],
  resources: [],
  statusCode: 200,
  inlineScriptContent: '',
  jsBundleUrls: [],
  tls,
});

describe('P1-04: TLS Configuration Module', () => {
  describe('HTTPS Detection', () => {
    it('should flag sites not using HTTPS', () => {
      const crawlResult = createCrawlResult('http://example.com');
      const findings = runTLSModule(crawlResult);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].title).toContain('does not use HTTPS');
      expect(findings[0].category).toBe('TLS Configuration');
    });

    it('should not flag HTTPS sites', () => {
      const crawlResult = createCrawlResult('https://example.com', {
        valid: true,
        protocol: 'TLSv1.3',
        cipher: 'TLS_AES_128_GCM_SHA256',
        issuer: "Let's Encrypt",
        subject: 'example.com',
        issuedAt: new Date('2024-01-01'),
        expiresAt: new Date('2025-01-01'),
        daysUntilExpiry: 200,
        subjectAltNames: ['example.com', 'www.example.com'],
      });
      const findings = runTLSModule(crawlResult);

      expect(findings).toHaveLength(0);
    });
  });

  describe('Certificate Validation', () => {
    it('should flag invalid TLS certificates', () => {
      const crawlResult = createCrawlResult('https://example.com', {
        valid: false,
        protocol: 'TLSv1.3',
        cipher: 'TLS_AES_128_GCM_SHA256',
        issuer: 'Self-signed',
        subject: 'example.com',
        issuedAt: new Date('2024-01-01'),
        expiresAt: new Date('2025-01-01'),
        daysUntilExpiry: 200,
        subjectAltNames: ['example.com'],
      });
      const findings = runTLSModule(crawlResult);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].title).toContain('certificate is invalid');
    });

    it('should not flag valid certificates', () => {
      const crawlResult = createCrawlResult('https://example.com', {
        valid: true,
        protocol: 'TLSv1.3',
        cipher: 'TLS_AES_128_GCM_SHA256',
        issuer: "Let's Encrypt",
        subject: 'example.com',
        issuedAt: new Date('2024-01-01'),
        expiresAt: new Date('2025-01-01'),
        daysUntilExpiry: 200,
        subjectAltNames: ['example.com'],
      });
      const findings = runTLSModule(crawlResult);

      expect(findings).toHaveLength(0);
    });
  });

  describe('Certificate Expiry', () => {
    it('should flag certificates expiring in 7 days or less as CRITICAL', () => {
      const crawlResult = createCrawlResult('https://example.com', {
        valid: true,
        protocol: 'TLSv1.3',
        cipher: 'TLS_AES_128_GCM_SHA256',
        issuer: "Let's Encrypt",
        subject: 'example.com',
        issuedAt: new Date('2024-01-01'),
        expiresAt: new Date('2024-01-08'),
        daysUntilExpiry: 5,
        subjectAltNames: ['example.com'],
      });
      const findings = runTLSModule(crawlResult);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].title).toContain('expires in 5 days');
    });

    it('should flag certificates expiring in 8-14 days as HIGH', () => {
      const crawlResult = createCrawlResult('https://example.com', {
        valid: true,
        protocol: 'TLSv1.3',
        cipher: 'TLS_AES_128_GCM_SHA256',
        issuer: "Let's Encrypt",
        subject: 'example.com',
        issuedAt: new Date('2024-01-01'),
        expiresAt: new Date('2024-01-15'),
        daysUntilExpiry: 10,
        subjectAltNames: ['example.com'],
      });
      const findings = runTLSModule(crawlResult);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('HIGH');
      expect(findings[0].title).toContain('expires in 10 days');
    });

    it('should flag certificates expiring in 15-30 days as MEDIUM', () => {
      const crawlResult = createCrawlResult('https://example.com', {
        valid: true,
        protocol: 'TLSv1.3',
        cipher: 'TLS_AES_128_GCM_SHA256',
        issuer: "Let's Encrypt",
        subject: 'example.com',
        issuedAt: new Date('2024-01-01'),
        expiresAt: new Date('2024-02-01'),
        daysUntilExpiry: 20,
        subjectAltNames: ['example.com'],
      });
      const findings = runTLSModule(crawlResult);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('MEDIUM');
      expect(findings[0].title).toContain('expires in 20 days');
    });

    it('should not flag certificates with >30 days until expiry', () => {
      const crawlResult = createCrawlResult('https://example.com', {
        valid: true,
        protocol: 'TLSv1.3',
        cipher: 'TLS_AES_128_GCM_SHA256',
        issuer: "Let's Encrypt",
        subject: 'example.com',
        issuedAt: new Date('2024-01-01'),
        expiresAt: new Date('2025-01-01'),
        daysUntilExpiry: 200,
        subjectAltNames: ['example.com'],
      });
      const findings = runTLSModule(crawlResult);

      expect(findings).toHaveLength(0);
    });
  });

  describe('TLS Protocol Version', () => {
    it('should flag TLS 1.0 as HIGH severity', () => {
      const crawlResult = createCrawlResult('https://example.com', {
        valid: true,
        protocol: 'TLSv1',
        cipher: 'TLS_RSA_WITH_AES_128_CBC_SHA',
        issuer: "Let's Encrypt",
        subject: 'example.com',
        issuedAt: new Date('2024-01-01'),
        expiresAt: new Date('2025-01-01'),
        daysUntilExpiry: 200,
        subjectAltNames: ['example.com'],
      });
      const findings = runTLSModule(crawlResult);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('HIGH');
      expect(findings[0].title).toContain('Outdated TLS protocol');
      expect(findings[0].title).toContain('TLSv1');
    });

    it('should flag TLS 1.1 as HIGH severity', () => {
      const crawlResult = createCrawlResult('https://example.com', {
        valid: true,
        protocol: 'TLSv1.1',
        cipher: 'TLS_RSA_WITH_AES_128_CBC_SHA',
        issuer: "Let's Encrypt",
        subject: 'example.com',
        issuedAt: new Date('2024-01-01'),
        expiresAt: new Date('2025-01-01'),
        daysUntilExpiry: 200,
        subjectAltNames: ['example.com'],
      });
      const findings = runTLSModule(crawlResult);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('HIGH');
      expect(findings[0].title).toContain('TLSv1.1');
    });

    it('should accept TLS 1.2', () => {
      const crawlResult = createCrawlResult('https://example.com', {
        valid: true,
        protocol: 'TLSv1.2',
        cipher: 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
        issuer: "Let's Encrypt",
        subject: 'example.com',
        issuedAt: new Date('2024-01-01'),
        expiresAt: new Date('2025-01-01'),
        daysUntilExpiry: 200,
        subjectAltNames: ['example.com'],
      });
      const findings = runTLSModule(crawlResult);

      expect(findings).toHaveLength(0);
    });

    it('should accept TLS 1.3', () => {
      const crawlResult = createCrawlResult('https://example.com', {
        valid: true,
        protocol: 'TLSv1.3',
        cipher: 'TLS_AES_256_GCM_SHA384',
        issuer: "Let's Encrypt",
        subject: 'example.com',
        issuedAt: new Date('2024-01-01'),
        expiresAt: new Date('2025-01-01'),
        daysUntilExpiry: 200,
        subjectAltNames: ['example.com'],
      });
      const findings = runTLSModule(crawlResult);

      expect(findings).toHaveLength(0);
    });
  });

  describe('No TLS Info', () => {
    it('should handle missing TLS info gracefully', () => {
      const crawlResult = createCrawlResult('https://example.com');
      const findings = runTLSModule(crawlResult);

      expect(findings).toHaveLength(0);
    });
  });
});
