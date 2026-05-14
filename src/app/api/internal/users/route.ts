/**
 * Phase 3.7.1 — GET /api/internal/users?q=<email-substring>
 *
 * Admin user lookup. Returns up to 25 matches, with the quota fields needed
 * to drive the override form on /internal/users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertAdminApi } from '@/lib/auth/helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await assertAdminApi();
  if (!auth.ok) return auth.response;

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length === 0) {
    return NextResponse.json({ users: [] });
  }

  const users = await prisma.user.findMany({
    where: { email: { contains: q } },
    select: {
      id: true,
      email: true,
      tier: true,
      scansThisWeek: true,
      scanWeekStart: true,
      activeTestCredits: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });

  return NextResponse.json({ users });
}
