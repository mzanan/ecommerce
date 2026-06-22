import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { OrderItemDetail } from '@/types/stripe';

export interface PricedOrderItem {
  product_variant_id: string;
  product_id: string;
  quantity: number;
  price_at_purchase: number;
  product_name: string;
  product_size: string | null;
}

export interface PricedCart {
  items: PricedOrderItem[];
  subtotal: number;
}

interface VariantWithProduct {
  id: string;
  size_name: string | null;
  product_id: string;
  products:
    | { name: string; price: number; is_active: boolean | null; stock_quantity: number | null }
    | null;
}

/**
 * Re-prices a requested cart from the database. The client NEVER decides prices:
 * every line is priced at `products.price` and validated against current stock.
 * Returns an error string for any unavailable item or insufficient stock.
 */
export async function priceCartFromDb(
  supabase: SupabaseClient<Database>,
  requested: OrderItemDetail[],
): Promise<{ data?: PricedCart; error?: string }> {
  if (!requested || requested.length === 0) {
    return { error: 'Cart is empty.' };
  }

  const variantIds = Array.from(new Set(requested.map((i) => i.variantId)));

  const { data, error } = await supabase
    .from('product_variants')
    .select('id, size_name, product_id, products(name, price, is_active, stock_quantity)')
    .in('id', variantIds);

  if (error) {
    console.error('[pricing] Failed to load variants:', error.message);
    return { error: 'Failed to load product prices.' };
  }

  const variants = (data ?? []) as unknown as VariantWithProduct[];
  const byVariant = new Map(variants.map((v) => [v.id, v]));

  const items: PricedOrderItem[] = [];
  const qtyByProduct = new Map<string, number>();

  for (const req of requested) {
    if (!Number.isInteger(req.quantity) || req.quantity <= 0) {
      return { error: 'Invalid quantity in cart.' };
    }
    const variant = byVariant.get(req.variantId);
    const product = variant?.products ?? null;
    if (!variant || !product || product.is_active === false) {
      return { error: 'One or more products are no longer available.' };
    }

    items.push({
      product_variant_id: variant.id,
      product_id: variant.product_id,
      quantity: req.quantity,
      price_at_purchase: Number(product.price),
      product_name: product.name,
      product_size: variant.size_name ?? null,
    });

    qtyByProduct.set(variant.product_id, (qtyByProduct.get(variant.product_id) ?? 0) + req.quantity);
  }

  // Stock is tracked per product; aggregate requested quantity across its variants.
  for (const [productId, qty] of Array.from(qtyByProduct.entries())) {
    const stock = variants.find((v) => v.product_id === productId)?.products?.stock_quantity ?? 0;
    if (stock < qty) {
      return { error: 'Insufficient stock for one or more items.' };
    }
  }

  const subtotal = items.reduce((sum, i) => sum + i.price_at_purchase * i.quantity, 0);
  return { data: { items, subtotal } };
}

/**
 * Authoritative shipping price for a country, read from the DB. Unknown country
 * (no configured row) ships at 0 — the customer is charged exactly the displayed
 * total, since PI creation and order validation both use this same value.
 */
export async function getShippingPriceFromDb(
  supabase: SupabaseClient<Database>,
  countryCode: string | null | undefined,
): Promise<number> {
  if (!countryCode) return 0;
  const { data } = await supabase
    .from('country_shipping_prices')
    .select('shipping_price')
    .eq('country_code', countryCode)
    .maybeSingle();
  return Number(data?.shipping_price ?? 0);
}
