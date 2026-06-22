-- Secure, server-authoritative order flow.
--
-- Before this migration orders were written client-side by a public service-role
-- action that trusted client-supplied prices and never verified the payment. This
-- migration moves order creation behind the Stripe webhook:
--   1. At payment-confirmation time the server validates + RE-PRICES the cart from
--      the DB and stores a draft in `pending_orders` (service-role only).
--   2. The webhook (payment_intent.succeeded) calls create_order_from_payment(),
--      which atomically promotes the draft into a real paid order.
-- Prices/totals are never trusted from the client. Idempotency is guaranteed by
-- orders.payment_intent_id (UNIQUE). Stock decrement + confirmation email are the
-- existing triggers on orders/order_items INSERT (migrations 005 / 006 / 009).

-- 1. Draft table. RLS on with NO policies => only the service role (which bypasses
--    RLS) can touch it. Never readable/writable from the client.
CREATE TABLE IF NOT EXISTS pending_orders (
  payment_intent_id TEXT PRIMARY KEY,
  shipping JSONB NOT NULL,
  items JSONB NOT NULL,
  shipping_price NUMERIC NOT NULL DEFAULT 0 CHECK (shipping_price >= 0),
  total_amount NUMERIC NOT NULL CHECK (total_amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE pending_orders ENABLE ROW LEVEL SECURITY;

-- 2. Atomic, idempotent promotion of a draft into a paid order.
--    Inserting the order (status='paid') fires the order-number + confirmation-email
--    triggers; inserting order_items fires the stock-decrement trigger, which RAISEs
--    on oversell and rolls back the whole transaction (no partial/oversold order).
CREATE OR REPLACE FUNCTION create_order_from_payment(p_payment_intent_id TEXT)
RETURNS UUID AS $$
DECLARE
  draft pending_orders%ROWTYPE;
  existing_id UUID;
  new_order_id UUID;
  item JSONB;
BEGIN
  -- Idempotency fast-path: order already exists for this PI -> drop draft, return it.
  SELECT id INTO existing_id FROM orders WHERE payment_intent_id = p_payment_intent_id;
  IF existing_id IS NOT NULL THEN
    DELETE FROM pending_orders WHERE payment_intent_id = p_payment_intent_id;
    RETURN existing_id;
  END IF;

  SELECT * INTO draft FROM pending_orders WHERE payment_intent_id = p_payment_intent_id;
  IF NOT FOUND THEN
    -- No draft for this PI (event not from our checkout, or draft lost). Caller logs;
    -- returning NULL avoids a Stripe retry storm on an unrecoverable event.
    RETURN NULL;
  END IF;

  INSERT INTO orders (
    shipping_name, shipping_email, shipping_phone,
    shipping_address1, shipping_address2, shipping_city, shipping_state,
    shipping_postal_code, shipping_country,
    total_amount, payment_intent_id, status, shipping_status, order_details
  ) VALUES (
    draft.shipping->>'name', draft.shipping->>'email', draft.shipping->>'phone',
    draft.shipping->>'address1', COALESCE(draft.shipping->>'address2', ''),
    draft.shipping->>'city', draft.shipping->>'state',
    draft.shipping->>'postalCode', draft.shipping->>'country',
    draft.total_amount, p_payment_intent_id, 'paid', 'pending',
    jsonb_build_object('items', draft.items, 'shipping_price', draft.shipping_price)
  )
  RETURNING id INTO new_order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(draft.items)
  LOOP
    INSERT INTO order_items (
      order_id, product_variant_id, quantity, price_at_purchase, product_name, product_size
    ) VALUES (
      new_order_id,
      (item->>'product_variant_id')::UUID,
      (item->>'quantity')::INTEGER,
      (item->>'price_at_purchase')::NUMERIC,
      item->>'product_name',
      item->>'product_size'
    );
  END LOOP;

  DELETE FROM pending_orders WHERE payment_intent_id = p_payment_intent_id;

  RETURN new_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only the webhook (service role) may create orders this way.
REVOKE ALL ON FUNCTION create_order_from_payment(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_order_from_payment(TEXT) FROM anon;
REVOKE ALL ON FUNCTION create_order_from_payment(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION create_order_from_payment(TEXT) TO service_role;
