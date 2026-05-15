import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { checkWeeklyScanQuota } from '@/lib/rate-limiter';
import { type UserTier } from '@/lib/tier-gating';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { tier: true, activeTestCredits: true },
  });

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  const tier = (dbUser.tier || 'free') as UserTier;

  // For free tier, calculate remaining weekly passive scans without consuming
  let weeklyScansRemaining: number | null = null;
  let weeklyLimit: number | null = null;
  if (tier === 'free') {
    const quota = await checkWeeklyScanQuota(user.id, tier, false);
    weeklyScansRemaining = quota.remaining;
    weeklyLimit = quota.limit;
  }

  return NextResponse.json(
    { tier, activeTestCredits: dbUser.activeTestCredits, weeklyScansRemaining, weeklyLimit },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
