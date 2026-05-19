import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, hasTier } from '@/lib/auth/helpers';
import { isTierGatingEnabled } from '@/lib/tier-gating';
import { normalizeDomain } from '@/lib/verify-domain';
import { ValidationError } from '@/lib/url-validator';
import {
  estimateSeconds,
  isSupportedTest,
  runActiveTest,
  type ActiveTestKey,
} from '@/lib/active-test-worker';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  // Tier gate (authoritative, defense-in-depth — the UI gate alone is not
  // enough). The active DAST surface is a paid feature: per business.md it is
  // unlocked starting at the 'one-shot' tier (Verify — 1 active DAST scan);
  // 'free' is blocked. We do NOT hard-code the hierarchy here — hasTier owns
  // it (free < one-shot < pro < studio). Mirrors how tier-gating is bypassed
  // elsewhere when the TIER_GATING feature flag is off, so flag-off behaviour
  // stays byte-identical to before this gate existed.
  if (isTierGatingEnabled() && !hasTier(user, 'one-shot')) {
    return NextResponse.json(
      {
        error: 'Active DAST testing requires a paid plan. Upgrade to run active tests.',
        code: 'TIER_REQUIRED',
      },
      { status: 403 },
    );
  }

  let body: { domain?: string; tests?: unknown };
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

  const rawTests = Array.isArray(body.tests) ? body.tests : [];
  const tests: ActiveTestKey[] = [];
  for (const raw of rawTests) {
    if (typeof raw === 'string' && isSupportedTest(raw) && !tests.includes(raw)) {
      tests.push(raw);
    }
  }
  if (tests.length === 0) {
    return NextResponse.json({ error: 'Select at least one supported test.' }, { status: 400 });
  }

  const verification = await prisma.domainVerification.findFirst({
    where: { userId: user.id, domain, verifiedAt: { not: null } },
  });
  if (!verification) {
    return NextResponse.json(
      { error: 'Domain is not verified. Complete verification first.', code: 'DOMAIN_NOT_VERIFIED' },
      { status: 403 },
    );
  }

  const idempotencyKey = req.headers.get('idempotency-key')?.trim() || null;
  if (idempotencyKey) {
    const existing = await findExistingActiveTest(user.id, idempotencyKey);
    if (existing) {
      return NextResponse.json(
        {
          scan_id: existing.id,
          estimated_seconds: estimateSeconds(tests),
          idempotent: true,
        },
        { status: 200 },
      );
    }
  }

  const summary = {
    mode: 'active' as const,
    tests,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };

  const scan = await prisma.scan.create({
    data: {
      userId: user.id,
      targetUrl: `https://${domain}/`,
      tier: user.tier,
      status: 'QUEUED',
      summary: JSON.stringify(summary),
    },
  });

  runActiveTest(scan.id, tests).catch((err) => {
    logger.error('Active test worker crashed', { scanId: scan.id }, err);
  });

  logger.info('Active test started', {
    scanId: scan.id,
    userId: user.id,
    domain,
    tests,
    idempotencyKey,
  });

  return NextResponse.json(
    {
      scan_id: scan.id,
      estimated_seconds: estimateSeconds(tests),
      idempotent: false,
    },
    { status: 201 },
  );
}

async function findExistingActiveTest(userId: string, idempotencyKey: string) {
  const candidates = await prisma.scan.findMany({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    take: 50,
    select: { id: true, summary: true },
  });
  return candidates.find((row) => {
    if (!row.summary) return false;
    try {
      const parsed = JSON.parse(row.summary) as { mode?: string; idempotencyKey?: string };
      return parsed.mode === 'active' && parsed.idempotencyKey === idempotencyKey;
    } catch {
      return false;
    }
  });
}
