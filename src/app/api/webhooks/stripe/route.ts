import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { getStripe, mapSubscriptionToTier, isStripeEnabled } from '@/lib/stripe/client';
import { prisma } from '@/lib/prisma';
import { stripeConfig } from '@/lib/features';

// Disable body parsing for webhooks (Stripe needs raw body)
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: 'Stripe webhooks are not enabled' }, { status: 404 });
  }

  const stripe = getStripe();
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeConfig.webhookSecret);
  } catch (error) {
    console.error('[Stripe Webhook] Signature verification failed:', error);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(paymentIntent);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error processing event:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// ── Event Handlers ───────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log(`[Stripe] Checkout completed: ${session.id}`);

  const stripeCustomerId = session.customer as string;
  const tier = session.metadata?.tier || 'free';
  // Prefer client_reference_id (set on signed-in checkouts); fall back to
  // customer_email for anonymous purchases.
  const userIdFromRef = session.client_reference_id || session.metadata?.userId || null;
  const customerEmail = session.customer_email || session.customer_details?.email || null;

  // 1) Try by user ID first — most reliable, handles users who pay with a
  // different email than they signed up with.
  if (userIdFromRef) {
    const existing = await prisma.user.findUnique({ where: { id: userIdFromRef } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { tier, stripeCustomerId },
      });
      console.log(`[Stripe] Updated user (by ref): ${existing.id} → ${tier}`);
      return;
    }
    console.warn(`[Stripe] client_reference_id ${userIdFromRef} not found; falling back to email`);
  }

  // 2) Fall back to email match — anonymous-checkout flow.
  if (!customerEmail) {
    console.error('[Stripe] No customer email and no resolvable user ref in session');
    return;
  }

  const existingByEmail = await prisma.user.findUnique({ where: { email: customerEmail } });

  if (!existingByEmail) {
    const user = await prisma.user.create({
      data: { email: customerEmail, tier, stripeCustomerId },
    });
    console.log(`[Stripe] Created new user (by email): ${user.id}`);
  } else {
    await prisma.user.update({
      where: { id: existingByEmail.id },
      data: { tier, stripeCustomerId },
    });
    console.log(`[Stripe] Updated user (by email): ${existingByEmail.id} → ${tier}`);
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const stripeCustomerId = subscription.customer as string;
  const tier = mapSubscriptionToTier(subscription);

  console.log(`[Stripe] Subscription ${subscription.status}: ${stripeCustomerId} → ${tier}`);

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId },
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { tier },
    });
  } else {
    console.error(`[Stripe] User not found for customer: ${stripeCustomerId}`);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const stripeCustomerId = subscription.customer as string;

  console.log(`[Stripe] Subscription deleted: ${stripeCustomerId}`);

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId },
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { tier: 'free' },
    });
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[Stripe] Payment succeeded: ${paymentIntent.id}`);
  
  // For one-shot payments, tier is already set in checkout.session.completed
  // This is just for logging/tracking
}
