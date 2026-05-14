import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/helpers';
import {
  checkDnsTxt,
  checkMetaTag,
  markVerified,
  normalizeDomain,
  type VerifyMethod,
} from '@/lib/verify-domain';
import { prisma } from '@/lib/prisma';
import { ValidationError } from '@/lib/url-validator';
import { limiters, rateLimitHeaders } from '@/lib/ratelimit';
import { logger } from '@/lib/logger';

const VALID_METHODS = new Set<VerifyMethod>(['dns_txt', 'meta_tag']);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  let body: { domain?: string; method?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  let domain: string;
  try {
    domain = normalizeDomain(body.domain ?? '');
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const method = body.method as VerifyMethod | undefined;
  if (!method || !VALID_METHODS.has(method)) {
    return NextResponse.json(
      { error: 'method must be "dns_txt" or "meta_tag".' },
      { status: 400 },
    );
  }

  const userLimit = await limiters.verifyUser.limit(user.id);
  if (!userLimit.success) {
    return NextResponse.json(
      { error: 'Too many checks. Wait a second and try again.' },
      { status: 429, headers: rateLimitHeaders(userLimit) },
    );
  }

  const domainLimit = await limiters.verifyDomain.limit(`${user.id}:${domain}`);
  if (!domainLimit.success) {
    return NextResponse.json(
      { error: 'Too many checks for this domain. Wait a minute and try again.' },
      { status: 429, headers: rateLimitHeaders(domainLimit) },
    );
  }

  const verification = await prisma.domainVerification.findFirst({
    where: { userId: user.id, domain },
    orderBy: { createdAt: 'desc' },
  });
  if (!verification) {
    return NextResponse.json(
      { error: 'No verification initiated for this domain. Call /verify/init first.' },
      { status: 404 },
    );
  }

  try {
    const result =
      method === 'dns_txt'
        ? await checkDnsTxt(domain, verification.token)
        : await checkMetaTag(domain, verification.token);

    if (result.verified && !verification.verifiedAt) {
      await markVerified(verification.id, method);
    }

    return NextResponse.json(
      {
        verified: result.verified,
        method,
        detected_value: result.detectedValue,
        expected_value: result.expectedValue,
        reason: result.reason,
      },
      { headers: rateLimitHeaders(domainLimit) },
    );
  } catch (err) {
    logger.error('Verify check failed', { userId: user.id, domain, method }, err as Error);
    return NextResponse.json({ error: 'Verification check failed.' }, { status: 500 });
  }
}
