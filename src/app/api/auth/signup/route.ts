/**
 * Email/password signup.
 *
 * Creates a free-tier user with a scrypt-hashed password, then signs
 * them in immediately by establishing a NextAuth database session
 * (same session model the OAuth providers use). The browser is logged
 * in in place — the client just redirects after a 200.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/lib/features';
import { hashPassword } from '@/lib/auth/password';
import { establishSession } from '@/lib/auth/session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 200;
const MAX_NAME_LEN = 120;

export async function POST(req: NextRequest) {
  if (!authConfig.enabled || authConfig.provider !== 'nextauth') {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 503 });
  }

  let body: { name?: unknown; email?: unknown; password?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const name =
    typeof body.name === 'string' && body.name.trim()
      ? body.name.trim().slice(0, MAX_NAME_LEN)
      : null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LEN || password.length > MAX_PASSWORD_LEN) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: 'An account with this email already exists. Please sign in.' },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { email, name, passwordHash, tier: 'free' },
    select: { id: true },
  });

  const response = NextResponse.json({ ok: true }, { status: 201 });
  await establishSession(req, response, user.id);
  return response;
}
