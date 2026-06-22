'use server';

import Stripe from 'stripe';
import { z } from 'zod';
import { createServerActionClient, createServiceRoleClient } from '@/lib/supabase/server';
import { priceCartFromDb, getShippingPriceFromDb } from './pricing';
import { addressSchema } from '@/lib/schemas/checkoutSchemas';
import type { AddressFormValues } from '@/types/checkout';
import type { OrderItemDetail } from '@/types/stripe';
import type { Json } from '@/types/supabase';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const itemSchema = z.object({
  variantId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  priceAtPurchase: z.number().nonnegative(),
  size: z.string().nullable(),
  name: z.string().optional(),
});

const pendingOrderSchema = z.object({
  paymentIntentId: z.string().min(1),
  shippingAddress: addressSchema,
  items: z.array(itemSchema).min(1),
});

export interface CreatePendingOrderResponse {
  success?: boolean;
  error?: string;
}

/**
 * Records a SERVER-VALIDATED order draft for a PaymentIntent, to be finalized by
 * the Stripe webhook. Prices are re-derived from the DB and the PaymentIntent's
 * amount must match the recomputed total exactly — the client cannot dictate price
 * or fabricate an order. The webhook (payment_intent.succeeded) is the authoritative
 * writer; this only stages the data.
 */
export async function createPendingOrderAction(input: {
  paymentIntentId: string;
  shippingAddress: AddressFormValues;
  items: OrderItemDetail[];
}): Promise<CreatePendingOrderResponse> {
  const parsed = pendingOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Invalid order data.' };
  }
  const { paymentIntentId, shippingAddress, items } = parsed.data;

  // 1. The PaymentIntent must be a real Stripe intent (created by our server).
  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch {
    return { error: 'Payment session not found.' };
  }

  const supabase = createServerActionClient();

  // 2. Authoritative re-pricing from the DB (line prices + shipping for the country).
  const priced = await priceCartFromDb(supabase, items);
  if (priced.error || !priced.data) {
    return { error: priced.error || 'Failed to price cart.' };
  }
  const shippingPrice = await getShippingPriceFromDb(supabase, shippingAddress.country);
  const totalAmount = priced.data.subtotal + shippingPrice;
  const expectedCents = Math.round(totalAmount * 100);

  // 3. The charge amount MUST equal the server-recomputed total. Reject mismatches
  //    (tampering, or the cart/shipping changed after the intent was created).
  if (paymentIntent.amount !== expectedCents) {
    console.error('[pending-order] amount mismatch', {
      intent: paymentIntent.amount,
      expected: expectedCents,
    });
    return { error: 'Order total has changed. Please refresh and try again.' };
  }

  // 4. Stage the validated draft. pending_orders is RLS-locked to the server.
  const service = createServiceRoleClient();
  const { error } = await service.from('pending_orders').upsert(
    {
      payment_intent_id: paymentIntentId,
      shipping: {
        name: shippingAddress.name,
        email: shippingAddress.email,
        phone: shippingAddress.phone ?? null,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 ?? '',
        city: shippingAddress.city,
        state: shippingAddress.state ?? null,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country,
      },
      items: priced.data.items as unknown as Json,
      shipping_price: shippingPrice,
      total_amount: totalAmount,
    },
    { onConflict: 'payment_intent_id' },
  );

  if (error) {
    console.error('[pending-order] failed to persist draft:', error.message);
    return { error: 'Could not prepare your order. Please try again.' };
  }

  return { success: true };
}
