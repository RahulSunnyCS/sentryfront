import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { nextAuthConfig } from '@/lib/auth/nextauth-config';
import { authConfig, isFeatureReady } from '@/lib/features';

// Only enable NextAuth if AUTH_ENABLED=true and AUTH_PROVIDER=nextauth
const isNextAuthEnabled = isFeatureReady('auth') && authConfig.provider === 'nextauth';

// Initialize handler conditionally
let authHandler: ReturnType<typeof NextAuth> | null = null;
if (isNextAuthEnabled) {
  authHandler = NextAuth(nextAuthConfig);
}

export async function GET(request: Request) {
  if (!isNextAuthEnabled || !authHandler) {
    return NextResponse.json(
      { error: 'NextAuth is not enabled. Set AUTH_ENABLED=true and AUTH_PROVIDER=nextauth to use this auth provider.' },
      { status: 503 }
    );
  }
  return authHandler.handlers.GET(request);
}

export async function POST(request: Request) {
  if (!isNextAuthEnabled || !authHandler) {
    return NextResponse.json(
      { error: 'NextAuth is not enabled. Set AUTH_ENABLED=true and AUTH_PROVIDER=nextauth to use this auth provider.' },
      { status: 503 }
    );
  }
  return authHandler.handlers.POST(request);
}
