import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { nextAuthConfig } from '@/lib/auth/nextauth-config';
import { authConfig, isFeatureReady } from '@/lib/features';

const isNextAuthEnabled = isFeatureReady('auth') && authConfig.provider === 'nextauth';

// NextAuth v4 App Router: NextAuth(config) returns a single handler used for both GET and POST.
const handler = isNextAuthEnabled ? NextAuth(nextAuthConfig) : null;

function disabledResponse() {
  return NextResponse.json(
    { error: 'NextAuth is not enabled. Set AUTH_ENABLED=true and AUTH_PROVIDER=nextauth to use this auth provider.' },
    { status: 503 }
  );
}

export async function GET(request: Request, ctx: { params: { nextauth: string[] } }) {
  if (!handler) return disabledResponse();
  return handler(request, ctx);
}

export async function POST(request: Request, ctx: { params: { nextauth: string[] } }) {
  if (!handler) return disabledResponse();
  return handler(request, ctx);
}
