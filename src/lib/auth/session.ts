/**
 * Database-session helper.
 *
 * NextAuth here uses the PrismaAdapter "database" session strategy
 * (see nextauth-config.ts). To sign a user in outside the OAuth flow
 * (credentials signup / login, Google One Tap) we create a Session row
 * directly and set the NextAuth session cookie, exactly as NextAuth's
 * adapter would. This keeps a single session model across all providers.
 */

import crypto from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days — matches nextauth-config

/**
 * Create a persisted session for `userId` and attach the NextAuth
 * session cookie to `response`.
 */
export async function establishSession(
  req: NextRequest,
  response: NextResponse,
  userId: string,
): Promise<void> {
  const sessionToken = crypto.randomUUID() + crypto.randomBytes(16).toString('hex');
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: { sessionToken, userId, expires },
  });

  const isSecure = req.nextUrl.protocol === 'https:';
  const cookieName = isSecure
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';

  response.cookies.set({
    name: cookieName,
    value: sessionToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    path: '/',
    expires,
  });
}
