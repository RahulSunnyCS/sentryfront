import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { nextAuthConfig } from '@/lib/auth/nextauth-config';
import { authConfig } from '@/lib/features';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';

export async function POST() {
  if (!authConfig.enabled || authConfig.provider !== 'nextauth') {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 503 });
  }

  const session = await getServerSession(nextAuthConfig);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const email = session.user.email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ error: 'Email already verified' }, { status: 400 });
  }

  // Delete any existing token before issuing a fresh one
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.verificationToken.create({ data: { identifier: email, token, expires } });
  await sendVerificationEmail(email, token);

  return NextResponse.json({ ok: true });
}
