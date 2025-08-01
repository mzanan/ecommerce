import Stripe from 'npm:stripe@^15.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const COMPANY_INFO = {
  NAME: 'Infideli',
  WEBSITE_URL: Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://infideli.com',
  SUPPORT_EMAIL: 'support@infideli.com',
  CONTACT_EMAIL: 'contact@infideli.com',
} as const;

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2025-04-30.basil' as any, 
  httpClient: Stripe.createFetchHttpClient(), 
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    console.error('ERROR: Missing stripe-signature header');
    return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`ERROR: Webhook signature verification failed - ${err.message}`);
    return new Response(JSON.stringify({ error: `Webhook error: ${err.message}` }), { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      
      try {
        const attemptSessionUpdate = async (attempt: number = 1, maxAttempts: number = 3): Promise<boolean> => {
          const { data: existingOrder, error: checkError } = await supabase
            .from('orders')
            .select('id, status, payment_intent_id')
            .eq('payment_intent_id', session.payment_intent)
            .single();

          if (checkError && checkError.code !== 'PGRST116') {
            throw new Error('Database error while checking order');
          }

          if (!existingOrder) {
            if (attempt < maxAttempts) {
              const waitTime = Math.pow(2, attempt) * 1000;
              await new Promise(resolve => setTimeout(resolve, waitTime));
              return attemptSessionUpdate(attempt + 1, maxAttempts);
            } else {
              return false;
            }
          }

          if (existingOrder.status === 'paid' || existingOrder.status === 'completed') {
            console.log(`SUCCESS: Order ${existingOrder.id} status: ${existingOrder.status}`);
            return true;
          }

          const { error: updateError } = await supabase
            .from('orders')
            .update({ 
              status: 'paid',
              stripe_session_id: session.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingOrder.id);

          if (updateError) {
            throw new Error('Failed to update order for session');
          } else {
            console.log(`SUCCESS: Order ${existingOrder.id} status: paid`);
            return true;
          }
        };

        const success = await attemptSessionUpdate();
        
        if (!success) {
          console.error(`ERROR: Order not found for session ${session.id}`);
          return new Response(JSON.stringify({ 
            error: 'Order not found after retries for session',
            session_id: session.id,
            payment_intent_id: session.payment_intent
          }), { status: 500 });
        }

      } catch (error: any) {
        console.error(`ERROR: Failed processing checkout session - ${error.message}`);
        return new Response(JSON.stringify({ error: 'Processing error' }), { status: 500 });
      }
      break;

    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      try {
        const attemptOrderUpdate = async (attempt: number = 1, maxAttempts: number = 3): Promise<boolean> => {
          const { data: existingOrder, error: checkError } = await supabase
            .from('orders')
            .select('id, status, payment_intent_id')
            .eq('payment_intent_id', paymentIntent.id)
            .single();

          if (checkError && checkError.code !== 'PGRST116') {
            throw new Error('Database error while checking order');
          }

          if (!existingOrder) {
            if (attempt < maxAttempts) {
              const waitTime = Math.pow(2, attempt) * 1000;
              await new Promise(resolve => setTimeout(resolve, waitTime));
              return attemptOrderUpdate(attempt + 1, maxAttempts);
            } else {
              return false;
            }
          }

          if (existingOrder.status === 'paid' || existingOrder.status === 'completed') {
            console.log(`SUCCESS: Order ${existingOrder.id} status: ${existingOrder.status}`);
            return true;
          }

          const { error: updateError } = await supabase
            .from('orders')
            .update({ 
              status: 'paid',
              updated_at: new Date().toISOString()
            })
            .eq('payment_intent_id', paymentIntent.id);

          if (updateError) {
            throw new Error('Failed to update order status');
          } else {
            console.log(`SUCCESS: Order ${existingOrder.id} status: paid`);
            return true;
          }
        };

        const success = await attemptOrderUpdate();
        
        if (!success) {
          console.error(`ERROR: Order not found for payment_intent ${paymentIntent.id}`);
          return new Response(JSON.stringify({ 
            error: 'Order not found after retries',
            payment_intent_id: paymentIntent.id
          }), { status: 500 });
        }

      } catch (error: any) {
        console.error(`ERROR: Failed processing payment_intent.succeeded - ${error.message}`);
        return new Response(JSON.stringify({ error: 'Processing error' }), { status: 500 });
      }
      break;

    case 'payment_intent.payment_failed':
      const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
      
      try {
        const { data: existingOrder, error: checkError } = await supabase
          .from('orders')
          .select('id, status')
          .eq('payment_intent_id', failedPaymentIntent.id)
          .single();

        if (existingOrder && existingOrder.status === 'processing') {
          const { error: updateError } = await supabase
            .from('orders')
            .update({ 
              status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('payment_intent_id', failedPaymentIntent.id);

          if (updateError) {
            console.error(`ERROR: Failed updating order status to failed - ${updateError.message}`);
          } else {
            console.log(`SUCCESS: Order ${existingOrder.id} status: failed`);
          }
        }

      } catch (error: any) {
        console.error(`ERROR: Failed processing payment_intent.payment_failed - ${error.message}`);
      }
      break;

    default:
      console.warn(`WARNING: Unhandled event type: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}); 