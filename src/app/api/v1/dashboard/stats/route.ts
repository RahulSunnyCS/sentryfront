import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/helpers';
import { getDashboardStats } from '@/lib/dashboard-queries';
import { logger } from '@/lib/logger';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const stats = await getDashboardStats(user.id);
    return NextResponse.json(stats, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    });
  } catch (err) {
    logger.error('Dashboard stats failed', { userId: user.id }, err as Error);
    return NextResponse.json({ error: 'Failed to load stats.' }, { status: 500 });
  }
}
