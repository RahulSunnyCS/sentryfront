/**
 * Email verification endpoint.
 *
 * The link from the signup email lands here. On success:
 *   - marks User.emailVerified
 *   - deletes the one-time token
 *   - redirects to /dashboard?verified=1
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const BASE_URL = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';

  if (!token) {
    return NextResponse.redirect(`${BASE_URL}/login?error=invalid-link`);
  }

  const record = await prisma.verificationToken.findUnique({ where: { token } });

  if (!record) {
    return NextResponse.redirect(`${BASE_URL}/login?error=invalid-link`);
  }

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    return NextResponse.redirect(`${BASE_URL}/login?error=link-expired`);
  }

  // Mark the user verified and clean up the token in parallel.
  await Promise.all([
    prisma.user.update({
      where: { email: record.identifier },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({ where: { token } }),
  ]);

  return NextResponse.redirect(`${BASE_URL}/dashboard?verified=1`);
}
