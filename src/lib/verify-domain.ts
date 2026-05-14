import dns from 'dns/promises';
import { randomBytes } from 'crypto';
import { prisma } from './prisma';
import { validateAndNormalize, ValidationError } from './url-validator';
import { logger } from './logger';

export const TOKEN_PREFIX = 'vibesafe-verify=';
export const META_TAG_NAME = 'vibesafe-verify';
const TOKEN_BYTES = 12;
const META_FETCH_TIMEOUT_MS = 10_000;
const VERIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const DOMAIN_REGEX = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export type VerifyMethod = 'dns_txt' | 'meta_tag';

export interface CheckResult {
  verified: boolean;
  detectedValue: string | null;
  expectedValue: string;
  reason?: string;
}

export function normalizeDomain(raw: string): string {
  let trimmed = raw.trim().toLowerCase();
  trimmed = trimmed.replace(/^https?:\/\//, '');
  trimmed = trimmed.replace(/\/.*$/, '');
  trimmed = trimmed.replace(/:\d+$/, '');
  if (!DOMAIN_REGEX.test(trimmed)) {
    throw new ValidationError('Enter a valid domain like example.com (no protocol, no path).');
  }
  return trimmed;
}

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

export function tokenExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + VERIFICATION_TTL_MS);
}

export async function getOrCreateVerification(userId: string, domain: string) {
  const existing = await prisma.domainVerification.findFirst({
    where: { userId, domain },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing;

  return prisma.domainVerification.create({
    data: {
      userId,
      domain,
      token: generateToken(),
      method: 'dns_txt',
    },
  });
}

export async function checkDnsTxt(domain: string, token: string): Promise<CheckResult> {
  const expectedValue = `${TOKEN_PREFIX}${token}`;
  let records: string[][];
  try {
    records = await dns.resolveTxt(domain);
  } catch (err) {
    logger.info('DNS TXT lookup failed', { domain, error: String(err) });
    return {
      verified: false,
      detectedValue: null,
      expectedValue,
      reason: 'No TXT records found for this domain yet. DNS can take a few minutes to propagate.',
    };
  }

  const flat = records.map((parts) => parts.join(''));
  const match = flat.find((value) => value === expectedValue);
  if (match) {
    return { verified: true, detectedValue: match, expectedValue };
  }

  const vibesafeMisspelled = flat.find((value) => value.startsWith(TOKEN_PREFIX));
  return {
    verified: false,
    detectedValue: vibesafeMisspelled ?? null,
    expectedValue,
    reason: vibesafeMisspelled
      ? 'Found a vibesafe-verify TXT record but the value doesn\'t match.'
      : 'No vibesafe-verify TXT record found. It may still be propagating.',
  };
}

export async function checkMetaTag(domain: string, token: string): Promise<CheckResult> {
  const expectedValue = token;

  let safeUrl: string;
  try {
    safeUrl = await validateAndNormalize(domain);
  } catch (err) {
    const message = err instanceof ValidationError ? err.message : 'Domain cannot be reached.';
    return { verified: false, detectedValue: null, expectedValue, reason: message };
  }

  let html: string;
  try {
    const response = await fetch(safeUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'VibeSafe-Verifier/1.0 (+https://vibesafe.dev)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        verified: false,
        detectedValue: null,
        expectedValue,
        reason: `Domain responded with HTTP ${response.status}.`,
      };
    }

    html = (await response.text()).slice(0, 200_000);
  } catch (err) {
    logger.info('Meta tag fetch failed', { domain, error: String(err) });
    return {
      verified: false,
      detectedValue: null,
      expectedValue,
      reason: 'Couldn\'t fetch the homepage. Check that the site is publicly reachable.',
    };
  }

  const re = new RegExp(
    `<meta\\b[^>]*name=["']${META_TAG_NAME}["'][^>]*content=["']([^"']+)["']`,
    'i',
  );
  const altRe = new RegExp(
    `<meta\\b[^>]*content=["']([^"']+)["'][^>]*name=["']${META_TAG_NAME}["']`,
    'i',
  );
  const match = html.match(re) ?? html.match(altRe);
  if (!match) {
    return {
      verified: false,
      detectedValue: null,
      expectedValue,
      reason: 'No vibesafe-verify meta tag found in the homepage <head>.',
    };
  }

  const detectedValue = match[1];
  return {
    verified: detectedValue === expectedValue,
    detectedValue,
    expectedValue,
    reason: detectedValue === expectedValue ? undefined : 'Meta tag found but the content doesn\'t match.',
  };
}

export async function markVerified(verificationId: string, method: VerifyMethod) {
  return prisma.domainVerification.update({
    where: { id: verificationId },
    data: { verifiedAt: new Date(), method },
  });
}
