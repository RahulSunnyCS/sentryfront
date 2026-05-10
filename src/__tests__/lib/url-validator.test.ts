import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateAndNormalize, ValidationError } from '@/lib/url-validator';

// Mock DNS module
vi.mock('dns/promises', () => ({
  default: {
    resolve4: vi.fn(),
    resolve6: vi.fn(),
  },
}));

import dns from 'dns/promises';

describe('URL Validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('URL Format Validation', () => {
    it('should reject empty URLs', async () => {
      await expect(validateAndNormalize('')).rejects.toThrow(ValidationError);
      await expect(validateAndNormalize('   ')).rejects.toThrow('URL must not be empty');
    });

    it('should reject URLs exceeding max length', async () => {
      const longUrl = 'https://' + 'a'.repeat(2050);
      await expect(validateAndNormalize(longUrl)).rejects.toThrow('URL exceeds maximum length');
    });

    it('should reject invalid URL format', async () => {
      await expect(validateAndNormalize('not a url')).rejects.toThrow('Invalid URL format');
    });

    it('should reject non-http/https protocols', async () => {
      await expect(validateAndNormalize('ftp://example.com')).rejects.toThrow(ValidationError);
      await expect(validateAndNormalize('file:///etc/passwd')).rejects.toThrow(ValidationError);
    });
  });

  describe('URL Normalization', () => {
    it('should add https:// to URLs without protocol', async () => {
      (dns.resolve4 as any).mockResolvedValue(['1.2.3.4']);

      const result = await validateAndNormalize('example.com');

      expect(result).toBe('https://example.com');
    });

    it('should preserve https:// protocol', async () => {
      (dns.resolve4 as any).mockResolvedValue(['1.2.3.4']);

      const result = await validateAndNormalize('https://example.com');

      expect(result).toBe('https://example.com');
    });

    it('should preserve http:// protocol', async () => {
      (dns.resolve4 as any).mockResolvedValue(['1.2.3.4']);

      const result = await validateAndNormalize('http://example.com');

      expect(result).toBe('http://example.com');
    });
  });

  describe('Localhost Blocking', () => {
    it('should block localhost', async () => {
      await expect(validateAndNormalize('localhost')).rejects.toThrow('Cannot scan localhost');
      await expect(validateAndNormalize('http://localhost:3000')).rejects.toThrow(
        'Cannot scan localhost'
      );
    });

    it('should block 0.0.0.0', async () => {
      await expect(validateAndNormalize('0.0.0.0')).rejects.toThrow('Cannot scan localhost');
    });
  });

  describe('IP Address Blocking', () => {
    it('should block direct IPv4 addresses', async () => {
      await expect(validateAndNormalize('1.2.3.4')).rejects.toThrow(
        'Direct IP addresses are not accepted'
      );
      await expect(validateAndNormalize('http://192.168.1.1')).rejects.toThrow(
        'Direct IP addresses are not accepted'
      );
    });
  });

  describe('DNS Resolution', () => {
    it('should reject when DNS resolution fails', async () => {
      (dns.resolve4 as any).mockRejectedValue(new Error('ENOTFOUND'));
      (dns.resolve6 as any).mockRejectedValue(new Error('ENOTFOUND'));

      await expect(validateAndNormalize('nonexistent-domain-12345.com')).rejects.toThrow(
        'Could not resolve hostname'
      );
    });

    it('should accept valid domains that resolve', async () => {
      (dns.resolve4 as any).mockResolvedValue(['1.2.3.4']);

      const result = await validateAndNormalize('example.com');

      expect(result).toBe('https://example.com');
      expect(dns.resolve4).toHaveBeenCalledWith('example.com');
    });

    it('should fallback to IPv6 if IPv4 fails', async () => {
      (dns.resolve4 as any).mockRejectedValue(new Error('No A records'));
      (dns.resolve6 as any).mockResolvedValue(['2001:db8::1']);

      const result = await validateAndNormalize('ipv6-only.com');

      expect(result).toBe('https://ipv6-only.com');
    });
  });

  describe('Private IP Blocking', () => {
    it('should block RFC-1918 private IPs (10.x.x.x)', async () => {
      (dns.resolve4 as any).mockResolvedValue(['10.0.0.1']);

      await expect(validateAndNormalize('internal.example.com')).rejects.toThrow(
        'private, reserved, or cloud metadata IP'
      );
    });

    it('should block RFC-1918 private IPs (192.168.x.x)', async () => {
      (dns.resolve4 as any).mockResolvedValue(['192.168.1.1']);

      await expect(validateAndNormalize('router.local')).rejects.toThrow(
        'private, reserved, or cloud metadata IP'
      );
    });

    it('should block RFC-1918 private IPs (172.16-31.x.x)', async () => {
      (dns.resolve4 as any).mockResolvedValue(['172.16.0.1']);

      await expect(validateAndNormalize('private.network')).rejects.toThrow(
        'private, reserved, or cloud metadata IP'
      );
    });

    it('should block loopback IPs (127.x.x.x)', async () => {
      (dns.resolve4 as any).mockResolvedValue(['127.0.0.1']);

      await expect(validateAndNormalize('loopback.test')).rejects.toThrow(
        'private, reserved, or cloud metadata IP'
      );
    });

    it('should block link-local IPs (169.254.x.x)', async () => {
      (dns.resolve4 as any).mockResolvedValue(['169.254.1.1']);

      await expect(validateAndNormalize('link-local.test')).rejects.toThrow(
        'private, reserved, or cloud metadata IP'
      );
    });
  });

  describe('Cloud Metadata Endpoint Blocking', () => {
    it('should block AWS/GCP metadata endpoint (169.254.169.254)', async () => {
      (dns.resolve4 as any).mockResolvedValue(['169.254.169.254']);

      await expect(validateAndNormalize('metadata.cloud')).rejects.toThrow(
        'private, reserved, or cloud metadata IP'
      );
    });

    it('should block Alibaba Cloud metadata endpoint', async () => {
      (dns.resolve4 as any).mockResolvedValue(['100.100.100.200']);

      await expect(validateAndNormalize('alibaba-meta.cloud')).rejects.toThrow(
        'private, reserved, or cloud metadata IP'
      );
    });
  });
});
