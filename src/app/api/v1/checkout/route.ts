import { NextRequest, NextResponse } from 'next/server';
import { getStripe, STRIPE_PRICES, isStripeEnabled } from '@/lib/stripe/client';
import { getCurrentUser } from '@/lib/auth/helpers';

export async function POST(req: NextRequest) {
  // Check if Stripe is enabled
  if (!isStripeEnabled()) {
    return NextResponse.json(
      {
        error:
          'Payments are not enabled. Set STRIPE_ENABLED=true and configure Stripe credentials.',
      },
      { status: 404 }
    );
  }

  try {
    const body = await req.json();
    const { tier, successUrl, cancelUrl } = body as {
      tier: 'one-shot' | 'pro' | 'studio';
      successUrl?: string;
      cancelUrl?: string;
    };

    if (!tier || !['one-shot', 'pro', 'studio'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid tier. Must be one of: one-shot, pro, studio' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Determine the price ID based on tier
    let priceId: string;
    let mode: 'payment' | 'subscription';

    if (tier === 'one-shot') {
      priceId = STRIPE_PRICES.oneShot;
      mode = 'payment';
    } else if (tier === 'pro') {
      priceId = STRIPE_PRICES.proMonthly;
      mode = 'subscription';
    } else if (tier === 'studio') {
      priceId = STRIPE_PRICES.studioMonthly;
      mode = 'subscription';
    } else {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    if (!priceId) {
      return NextResponse.json(
        {
          error: `Price ID not configured for tier: ${tier}. Set STRIPE_PRICE_ID_${tier.toUpperCase().replace('-', '_')} in environment variables.`,
        },
        { status: 500 }
      );
    }

    // Get base URL for redirect
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // Link the session to the signed-in user (if any), so the webhook can
    // resolve the user by ID instead of by best-effort email match.
    const user = await getCurrentUser();

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
        ...(user ? { userId: user.id } : {}),
      },
      ...(user ? { client_reference_id: user.id, customer_email: user.email } : {}),
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
