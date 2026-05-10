import NextAuth from 'next-auth';
import { nextAuthConfig } from '@/lib/auth/nextauth-config';
import { authConfig, isFeatureReady } from '@/lib/features';

// Only enable NextAuth if AUTH_ENABLED=true and AUTH_PROVIDER=nextauth
if (!isFeatureReady('auth') || authConfig.provider !== 'nextauth') {
  throw new Error(
    'NextAuth is not enabled. Set AUTH_ENABLED=true and AUTH_PROVIDER=nextauth to use this auth provider.'
  );
}

const handler = NextAuth(nextAuthConfig);

export { handler as GET, handler as POST };
