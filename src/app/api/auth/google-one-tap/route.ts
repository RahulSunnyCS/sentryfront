/**
 * Google One Tap sign-in endpoint.
 *
 * Verifies a Google ID token, upserts the user, and creates a NextAuth
 * database session (so the existing PrismaAdapter session strategy keeps
 * working). The client (login-card.tsx) POSTs the credential it receives
 * from Google's GSI library and the browser is signed in in place.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/lib/features';

interface GoogleTokenInfo {
  aud?: string;
  iss?: string;
  exp?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  sub?: string;
}

async function verifyGoogleIdToken(idToken: string): Promise<GoogleTokenInfo | null> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { cache: 'no-store' },
  );
  if (!res.ok) return null;
  const info = (await res.json()) as GoogleTokenInfo;

  const expectedAud = authConfig.nextauth.google.clientId;
  if (!expectedAud || info.aud !== expectedAud) return null;
  if (info.iss && info.iss !== 'accounts.google.com' && info.iss !== 'https://accounts.google.com') {
    return null;
  }
  if (info.exp && Number(info.exp) * 1000 < Date.now()) return null;
  const emailVerified = info.email_verified === true || info.email_verified === 'true';
  if (!info.email || !emailVerified) return null;

  return info;
}

export async function POST(req: NextRequest) {
  if (!authConfig.enabled || authConfig.provider !== 'nextauth') {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 503 });
  }

  let body: { credential?: string };
  try {
    body = (await req.json()) as { credential?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const credential = body.credential;
  if (!credential || typeof credential !== 'string') {
    return NextResponse.json({ error: 'Missing credential' }, { status: 400 });
  }

  const info = await verifyGoogleIdToken(credential);
  if (!info?.email) {
    return NextResponse.json({ error: 'Invalid Google credential' }, { status: 401 });
  }

  const user = await prisma.user.upsert({
    where: { email: info.email },
    update: {
      name: info.name ?? undefined,
      image: info.picture ?? undefined,
    },
    create: {
      email: info.email,
      name: info.name ?? null,
      image: info.picture ?? null,
      emailVerified: new Date(),
    },
  });

  const sessionToken = crypto.randomUUID() + crypto.randomBytes(16).toString('hex');
  const maxAgeSeconds = 30 * 24 * 60 * 60;
  const expires = new Date(Date.now() + maxAgeSeconds * 1000);

  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires },
  });

  const isSecure = req.nextUrl.protocol === 'https:';
  const cookieName = isSecure
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: cookieName,
    value: sessionToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    path: '/',
    expires,
  });
  return response;
}
