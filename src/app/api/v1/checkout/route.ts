import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';
import { getStripe, STRIPE_PRICES, isStripeEnabled } from '@/lib/stripe/client';

// Map internal tier id → DAST credits granted on a one-time purchase
// (Monitor / studio is a subscription, no credit grant here.)
const CREDITS_BY_TIER: Record<'one-shot' | 'pro' | 'studio', number> = {
  'one-shot': 1, // Verify
  pro: 5,        // Active Pack
  studio: 0,     // Monitor (subscription, no upfront credits)
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { tier, successUrl, cancelUrl } = body as {
    tier?: 'one-shot' | 'pro' | 'studio';
    successUrl?: string;
    cancelUrl?: string;
  };

  if (!tier || !['one-shot', 'pro', 'studio'].includes(tier)) {
    return NextResponse.json(
      { error: 'Invalid tier. Must be one of: one-shot, pro, studio' },
      { status: 400 }
    );
  }

  // ── Early-phase payment test bypass ────────────────────────────────────────
  // PAYMENT_TEST_FLOW lets demo / early-access users click Upgrade and get
  // the entitlement without a real Stripe charge.
  //
  // SAFETY: hard-fail if anyone tries to enable this in production. See
  // "Pre-GA cleanup" in /root/.claude/plans/looks-good-now-but-rosy-coral.md
  // for the removal checklist before public launch.
  if (process.env.PAYMENT_TEST_FLOW === 'true') {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Checkout] PAYMENT_TEST_FLOW=true in production — refusing to bypass.');
      return NextResponse.json(
        { error: 'Payment test flow is not allowed in production.' },
        { status: 500 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Sign in to use the test bypass.' },
        { status: 401 }
      );
    }

    const credits = CREDITS_BY_TIER[tier];
    await prisma.user.update({
      where: { id: user.id },
      data: {
        tier,
        ...(credits > 0 && { activeTestCredits: { increment: credits } }),
      },
    });

    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    return NextResponse.json({
      sessionId: 'test_flow',
      url: `${protocol}://${host}/checkout/success?test=true&tier=${tier}`,
    });
  }

  // ── Real Stripe flow ──────────────────────────────────────────────────────
  if (!isStripeEnabled()) {
    return NextResponse.json(
      {
        error:
          'Payments are not enabled. Set STRIPE_ENABLED=true and configure Stripe credentials, or set PAYMENT_TEST_FLOW=true in dev.',
      },
      { status: 404 }
    );
  }

  try {
    const stripe = getStripe();

    let priceId: string;
    let mode: 'payment' | 'subscription';

    if (tier === 'one-shot') {
      // Verify — one-time $9
      priceId = STRIPE_PRICES.oneShot;
      mode = 'payment';
    } else if (tier === 'pro') {
      // Active Pack — one-time $29 (was subscription pre-pivot; reuse the env var name)
      priceId = STRIPE_PRICES.proMonthly;
      mode = 'payment';
    } else if (tier === 'studio') {
      // Monitor — $15/mo subscription
      priceId = STRIPE_PRICES.studioMonthly;
      mode = 'subscription';
    } else {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    if (!priceId) {
      return NextResponse.json(
        {
          error: `Price ID not configured for tier: ${tier}. Set STRIPE_PRICE_ID_${tier.toUpperCase().replace('-', '_')} in environment variables, or use PAYMENT_TEST_FLOW=true in dev.`,
        },
        { status: 500 }
      );
    }

    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${baseUrl}/checkout/cancel`,
      metadata: {
        tier,
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('[Checkout] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create checkout session',
      },
      { status: 500 }
    );
  }
}
