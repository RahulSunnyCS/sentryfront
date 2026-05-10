import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { features } from '@/lib/features';

export async function GET() {
  let dbStatus = 'ok';
  let dbError: string | undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    dbStatus = 'error';
    dbError = error instanceof Error ? error.message : 'Unknown error';
  }

  const dbType = (process.env.DATABASE_URL ?? 'file:').startsWith('postgresql')
    ? 'postgres'
    : 'sqlite';

  return NextResponse.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'dev',
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',

    // Core services
    db: {
      type: dbType,
      status: dbStatus,
      ...(dbError && { error: dbError }),
    },
    queue: process.env.REDIS_URL ? 'redis' : 'in-process',

    // Feature flags
    features: {
      scanDiff: features.scanDiff,
      pdfExport: features.pdfExport,
      stripe: features.stripe,
      auth: features.auth,
      tierGating: features.tierGating,
      llmEnrichment: features.llmEnrichment,
    },

    // Monitoring
    monitoring: {
      sentry: process.env.SENTRY_ENABLED === 'true',
    },
  });
}
