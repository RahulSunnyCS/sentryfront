/**
 * URL Validator with Security Hardening
 *
 * Blocks:
 * - Private IPs (RFC-1918, loopback, link-local)
 * - Cloud metadata endpoints (AWS, GCP, Azure, Oracle, DigitalOcean, Alibaba)
 * - Reserved/special IP ranges
 * - Direct IP addresses (requires domain names)
 */

import dns from 'dns/promises';
import net from 'net';
import { logger } from './logger';

// Cloud metadata endpoints (IPv4)
const BLOCKED_METADATA_IPS = new Set([
  '169.254.169.254', // AWS, Azure, GCP, Oracle
  '100.100.100.200', // Alibaba Cloud
  '169.254.0.1',     // DigitalOcean
  '169.254.1.1',     // DigitalOcean (alternate)
]);

// Private and reserved IP ranges
const PRIVATE_RANGES = [
  // RFC-1918 private networks
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,

  // Loopback
  /^127\./,
  /^::1$/,

  // Link-local
  /^169\.254\./,
  /^fe80:/i,

  // Unique local addresses (IPv6)
  /^fc00:/i,
  /^fd/i,

  // Special addresses
  /^0\.0\.0\.0$/,
  /^255\.255\.255\.255$/,

  // Multicast
  /^22[4-9]\./,
  /^23\d\./,
  /^ff0[0-9a-f]:/i,
];

function isPrivateIp(ip: string): boolean {
  // Check explicit blocklist
  if (BLOCKED_METADATA_IPS.has(ip)) {
    logger.warn('Blocked metadata endpoint', { ip });
    return true;
  }

  // Check private ranges
  const isPrivate = PRIVATE_RANGES.some((r) => r.test(ip));
  if (isPrivate) {
    logger.warn('Blocked private IP', { ip });
  }

  return isPrivate;
}

export class ValidationError extends Error {
  constructor(
    public readonly message: string,
    public readonly status = 422,
  ) {
    super(message);
  }
}

export async function validateAndNormalize(raw: string): Promise<string> {
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new ValidationError('URL must not be empty.');
  }

  if (trimmed.length > 2048) {
    throw new ValidationError('URL exceeds maximum length.');
  }

  // Add https:// if no scheme provided
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new ValidationError('Invalid URL format.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ValidationError('Only http and https URLs are supported.');
  }

  const { hostname } = parsed;

  // Block localhost
  if (hostname === 'localhost' || hostname === '0.0.0.0') {
    logger.warn('Blocked localhost', { hostname });
    throw new ValidationError('Cannot scan localhost.');
  }

  // Reject bare IP addresses — require a domain name
  if (net.isIP(hostname)) {
    logger.warn('Blocked direct IP address', { hostname });
    throw new ValidationError('Direct IP addresses are not accepted. Please provide a domain name.');
  }

  // Resolve the hostname and check all resulting IPs
  let addresses: string[];
  try {
    // Try IPv4 first, fall back to IPv6
    addresses = await dns.resolve4(hostname).catch(() => dns.resolve6(hostname));
  } catch (err) {
    logger.info('DNS resolution failed', { hostname, error: String(err) });
    throw new ValidationError(
      `Could not resolve hostname "${hostname}". Please check the URL and try again.`,
    );
  }

  // Check all resolved IPs (in case of round-robin DNS)
  for (const ip of addresses) {
    if (isPrivateIp(ip)) {
      throw new ValidationError(
        'The URL resolves to a private, reserved, or cloud metadata IP address and cannot be scanned.',
      );
    }
  }

  logger.info('URL validated', { url: withScheme, hostname, resolvedIps: addresses });

  return withScheme;
}
