'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { SaveOrderParams, SaveOrderResponse } from '@/types/order';
import { validateCartStockAction } from '@/lib/actions/stockActions';

export async function saveOrderAction(params: SaveOrderParams): Promise<SaveOrderResponse> {
  const supabase = createServiceRoleClient();
  
  try {
    const stockValidation = await validateCartStockAction(
      params.items.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity
      }))
    );

    if (!stockValidation.success) {
      return { error: stockValidation.error || 'Failed to validate stock' };
    }

    if (!stockValidation.data?.isValid) {
      const invalidItems = stockValidation.data?.stockValidation.filter(item => !item.isValid) || [];
      const errorMessages = invalidItems.map(item => item.errorMessage).join(', ');
      return { error: `Stock validation failed: ${errorMessages}` };
    }

    const productsTotal = params.items.reduce((sum, item) => sum + (item.quantity * item.priceAtPurchase), 0);
    const shippingPrice = params.shippingPrice || 0;

    const expectedTotal = productsTotal + shippingPrice;
    if (Math.abs(params.totalAmount - expectedTotal) > 0.01) {
      console.warn('[SAVE ORDER] Total amount mismatch!', {
        provided: params.totalAmount,
        calculated: expectedTotal,
        difference: params.totalAmount - expectedTotal
      });
    }

    const orderItems = [];
    for (const item of params.items) {
      const { data: variantData } = await supabase
        .from('product_variants')
        .select('product_id, products (name)')
        .eq('id', item.variantId)
        .single();

      const productName = variantData?.products?.name || item.name || 'Unknown Product';
      
      orderItems.push({
        product_variant_id: item.variantId,
        product_id: item.productId,
        quantity: item.quantity,
        price_at_purchase: item.priceAtPurchase,
        size: item.size,
        product_name: productName
      });
    }

    const orderDetails = {
      items: orderItems,
      shipping_price: shippingPrice
    };

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        shipping_name: params.shippingAddress.name,
        shipping_email: params.shippingAddress.email,
        shipping_phone: params.shippingAddress.phone,
        shipping_address1: params.shippingAddress.address1,
        shipping_address2: params.shippingAddress.address2 || '',
        shipping_city: params.shippingAddress.city,
        shipping_state: params.shippingAddress.state,
        shipping_postal_code: params.shippingAddress.postalCode,
        shipping_country: params.shippingAddress.country,
        total_amount: params.totalAmount,
        payment_intent_id: params.paymentIntentId,
        status: 'paid',
        shipping_status: 'pending',
        order_details: orderDetails
      })
      .select('id')
      .single();

    if (orderError) {
      console.error('[SAVE ORDER] Error creating order:', orderError);
      return { error: `Failed to create order: ${orderError.message}` };
    }

    const orderItemsToInsert = orderItems.map(detail => ({
      order_id: orderData.id,
      product_variant_id: detail.product_variant_id,
      quantity: detail.quantity,
      price_at_purchase: detail.price_at_purchase,
      product_name: detail.product_name,
      product_size: detail.size
    }));

    const { error: orderItemsError } = await supabase
      .from('order_items')
      .insert(orderItemsToInsert);

    if (orderItemsError) {
      console.error('[SAVE ORDER] Error creating order items:', orderItemsError);
    }

    return { 
      orderId: orderData.id,
      userEmail: params.shippingAddress.email
    };

  } catch (error: any) {
            console.error('[SAVE ORDER] Unexpected error:', error);
        return { error: error.message || 'Failed to save order due to database or validation error.' };
  }
} 