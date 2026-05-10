import dns from 'dns/promises';
import net from 'net';

const BLOCKED_IPS = new Set(['169.254.169.254', '100.100.100.200']);

const PRIVATE_RANGES = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^127\./,
  /^::1$/,
  /^fc00:/i,
  /^fd/i,
  /^fe80:/i,
  /^0\.0\.0\.0$/,
];

function isPrivateIp(ip: string): boolean {
  if (BLOCKED_IPS.has(ip)) return true;
  return PRIVATE_RANGES.some((r) => r.test(ip));
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

  if (!trimmed) throw new ValidationError('URL must not be empty.');
  if (trimmed.length > 2048) throw new ValidationError('URL exceeds maximum length.');

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

  // Reject bare IP addresses — require a domain name
  if (net.isIP(hostname)) {
    throw new ValidationError('Direct IP addresses are not accepted. Please provide a domain name.');
  }

  // Resolve the hostname and check the resulting IP
  let addresses: string[];
  try {
    addresses = await dns.resolve4(hostname).catch(() => dns.resolve6(hostname));
  } catch {
    throw new ValidationError(
      `Could not resolve hostname "${hostname}". Please check the URL and try again.`,
    );
  }

  const firstIp = addresses[0];
  if (isPrivateIp(firstIp)) {
    throw new ValidationError(
      'The URL resolves to a private or reserved IP address and cannot be scanned.',
    );
  }

  return withScheme;
}
