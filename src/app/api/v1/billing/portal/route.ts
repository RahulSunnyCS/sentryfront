import { NextRequest, NextResponse } from 'next/server';
import { getStripe, isStripeEnabled } from '@/lib/stripe/client';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  if (!isStripeEnabled()) {
    return NextResponse.json(
      { error: 'Payments are not enabled.' },
      { status: 404 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { stripeCustomerId: true },
  });

  if (!dbUser?.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No active subscription to manage.', code: 'NO_STRIPE_CUSTOMER' },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { returnUrl?: string };
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const host = req.headers.get('host') || 'localhost:3000';
  const returnUrl = body.returnUrl || `${protocol}://${host}/dashboard`;

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: dbUser.stripeCustomerId,
      return_url: returnUrl,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    logger.error('Billing portal session failed', { userId: user.id }, err as Error);
    return NextResponse.json({ error: 'Failed to create portal session.' }, { status: 500 });
  }
}
