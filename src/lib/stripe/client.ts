/**
 * Stripe Client Configuration
 * 
 * Server-side Stripe instance for payment processing.
 * Only initialized when STRIPE_ENABLED=true.
 */

import Stripe from 'stripe';
import { stripeConfig, isFeatureReady } from '@/lib/features';

// ── Stripe Instance ──────────────────────────────────────────────────────────

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!isFeatureReady('stripe')) {
    throw new Error(
      'Stripe is not enabled or not properly configured. Set STRIPE_ENABLED=true and provide STRIPE_SECRET_KEY.'
    );
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(stripeConfig.secretKey, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });
  }

  return stripeInstance;
}

// ── Product IDs ──────────────────────────────────────────────────────────────

/**
 * Stripe Price IDs for each tier.
 * These should be created in Stripe Dashboard and environment variables.
 * 
 * Example:
 * STRIPE_PRICE_ID_ONE_SHOT=price_xxxxxxxxxxxxx
 * STRIPE_PRICE_ID_PRO_MONTHLY=price_xxxxxxxxxxxxx
 * STRIPE_PRICE_ID_STUDIO_MONTHLY=price_xxxxxxxxxxxxx
 */

export const STRIPE_PRICES = {
  oneShot: process.env.STRIPE_PRICE_ID_ONE_SHOT ?? '',
  proMonthly: process.env.STRIPE_PRICE_ID_PRO_MONTHLY ?? '',
  studioMonthly: process.env.STRIPE_PRICE_ID_STUDIO_MONTHLY ?? '',
} as const;

// ── Helper Functions ─────────────────────────────────────────────────────────

export function isStripeEnabled(): boolean {
  return isFeatureReady('stripe');
}

/**
 * Map Stripe subscription status to user tier
 */
export function mapSubscriptionToTier(subscription: Stripe.Subscription): string {
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    return 'free';
  }

  const priceId = subscription.items.data[0]?.price.id;

  if (priceId === STRIPE_PRICES.studioMonthly) {
    return 'studio';
  }

  if (priceId === STRIPE_PRICES.proMonthly) {
    return 'pro';
  }

  return 'free';
}

/**
 * Map payment intent to tier (for one-shot purchases)
 */
export function mapPaymentIntentToTier(paymentIntent: Stripe.PaymentIntent): string {
  const metadata = paymentIntent.metadata;

  if (metadata?.tier === 'one-shot') {
    return 'one-shot';
  }

  return 'free';
}
