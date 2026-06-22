'use server';

import Stripe from 'stripe';
import { createServerActionClient } from '@/lib/supabase/server';
import { priceCartFromDb, getShippingPriceFromDb } from '@/lib/actions/orders/pricing';
import type { CreatePaymentIntentResponse, OrderItemDetail } from '@/types/stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

// apiVersion omitted on purpose: the SDK uses the account's pinned default,
// avoiding a literal-type cast and version drift across SDK upgrades.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Creates a PaymentIntent whose amount is computed ENTIRELY server-side from the
 * database (line prices from `products`, shipping from `country_shipping_prices`).
 * The client supplies only which variants/quantities and the country — never prices.
 */
export async function createPaymentIntent(
  items: OrderItemDetail[],
  country: string,
  receiptEmail: string,
): Promise<CreatePaymentIntentResponse> {
  const supabase = createServerActionClient();

  const priced = await priceCartFromDb(supabase, items);
  if (priced.error || !priced.data) {
    return { error: priced.error || 'Failed to price cart.' };
  }

  const shippingPrice = await getShippingPriceFromDb(supabase, country);
  const amountInCents = Math.round((priced.data.subtotal + shippingPrice) * 100);

  if (amountInCents <= 0) {
    return { error: 'Invalid amount for payment intent.' };
  }

  try {
    const params: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        country: country || 'unknown',
        items_count: priced.data.items.length.toString(),
        shipping_price: shippingPrice.toString(),
      },
    };

    if (receiptEmail && receiptEmail.trim() !== '') {
      params.receipt_email = receiptEmail;
    }

    const paymentIntent = await stripe.paymentIntents.create(params);

    return {
      clientSecret: paymentIntent.client_secret ?? undefined,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create payment intent.';
    console.error('[stripe] Error creating payment intent:', message);
    return { error: message };
  }
}
