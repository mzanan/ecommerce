import Stripe from "stripe";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export async function POST(request: Request) {
  if (!stripe || !webhookSecret) {
    // Misconfiguration on our side — 200 so Stripe doesn't retry forever.
    console.error("[stripe-webhook] not configured (missing secret key or webhook secret)");
    return NextResponse.json({ received: true });
  }

  const body = await request.text();
  const headerList = await headers();
  const signature = headerList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(`[stripe-webhook] signature verification failed: ${message}`);
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase.rpc("create_order_from_payment", {
      p_payment_intent_id: paymentIntent.id,
    });

    if (error) {
      // Transient/unexpected (incl. oversell rollback). 500 => Stripe retries.
      console.error("[stripe-webhook] order creation failed", {
        paymentIntent: paymentIntent.id,
        code: error.code,
      });
      return NextResponse.json({ error: "Order creation failed" }, { status: 500 });
    }

    if (!data) {
      // No staged draft for this intent (event not from our checkout). Don't retry.
      console.warn("[stripe-webhook] no pending draft for intent", paymentIntent.id);
    }
  }

  return NextResponse.json({ received: true });
}
