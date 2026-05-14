import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/helpers';
import {
  getOrCreateVerification,
  normalizeDomain,
  tokenExpiresAt,
  TOKEN_PREFIX,
} from '@/lib/verify-domain';
import { ValidationError } from '@/lib/url-validator';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  let body: { domain?: string };
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

  try {
    const record = await getOrCreateVerification(user.id, domain);
    return NextResponse.json({
      domain: record.domain,
      token: `${TOKEN_PREFIX}${record.token}`,
      expires_at: tokenExpiresAt(record.createdAt).toISOString(),
      verified_at: record.verifiedAt?.toISOString() ?? null,
    });
  } catch (err) {
    logger.error('Verify init failed', { userId: user.id, domain }, err as Error);
    return NextResponse.json({ error: 'Failed to initialize verification.' }, { status: 500 });
  }
}
