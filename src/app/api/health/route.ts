import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  let dbStatus = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'error';
  }

  const dbType = (process.env.DATABASE_URL ?? 'file:').startsWith('postgresql')
    ? 'postgres'
    : 'sqlite';

  return NextResponse.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    db: `${dbType}:${dbStatus}`,
    queue: process.env.REDIS_URL ? 'redis' : 'in-process',
  });
}
