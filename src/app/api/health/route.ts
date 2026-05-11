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

  // Check required environment variables
  const requiredEnvVars = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    PAGESPEED_API_KEY: !!process.env.PAGESPEED_API_KEY,
  };

  const missingEnvVars = Object.entries(requiredEnvVars)
    .filter(([, exists]) => !exists)
    .map(([name]) => name);

  const overallStatus = dbStatus === 'error' || missingEnvVars.length > 0 ? 'error' : 'ok';

  return NextResponse.json({
    status: overallStatus,
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

    // Environment check
    env: {
      status: missingEnvVars.length === 0 ? 'ok' : 'error',
      required: requiredEnvVars,
      ...(missingEnvVars.length > 0 && { missing: missingEnvVars }),
    },

    // Feature flags
    features: {
      scanDiff: features.scanDiff,
      pdfExport: features.pdfExport,
      stripe: features.stripe,
      auth: features.auth,
      tierGating: features.tierGating,
      llmEnrichment: !!process.env.ANTHROPIC_API_KEY,
      performanceScanning: true,
      accessibilityScanning: true,
      seoScanning: true,
    },

    // Optional integrations
    integrations: {
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      stripe: !!process.env.STRIPE_SECRET_KEY,
      github: !!process.env.GITHUB_CLIENT_ID,
      google: !!process.env.GOOGLE_CLIENT_ID,
      redis: !!process.env.REDIS_URL,
      r2: !!process.env.R2_ACCESS_KEY_ID,
      sentry: !!process.env.SENTRY_DSN,
    },
  }, {
    status: overallStatus === 'ok' ? 200 : 503,
  });
}
