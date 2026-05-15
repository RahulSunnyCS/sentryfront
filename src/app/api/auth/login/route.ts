/**
 * Email/password sign-in.
 *
 * Verifies credentials against the scrypt password hash and, on success,
 * establishes a NextAuth database session (same model as OAuth). Errors
 * are intentionally generic to avoid leaking which accounts exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/lib/features';
import { verifyPassword } from '@/lib/auth/password';
import { establishSession } from '@/lib/auth/session';

const INVALID = 'Invalid email or password.';

export async function POST(req: NextRequest) {
  if (!authConfig.enabled || authConfig.provider !== 'nextauth') {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 503 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  await establishSession(req, response, user.id);
  return response;
}
