'use server';

import { createServerActionClient } from '@/lib/supabase/server';
import type { ActionResponse } from '@/types/actions';

/**
 * Get current stock for a product from the database
 */
export async function getCurrentStockAction(productId: string): Promise<ActionResponse<{ availableStock: number }>> {
  if (!productId) {
    return { success: false, error: 'Product ID is required' };
  }

  const supabase = createServerActionClient();

  try {
    const { data, error } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('[Stock Action Error] Failed to get stock:', error);
      return { success: false, error: 'Failed to retrieve stock information' };
    }

    return {
      success: true,
      data: { availableStock: data?.stock_quantity || 0 }
    };
  } catch (error) {
    console.error('[Stock Action Error] Exception:', error);
    return { success: false, error: 'Unexpected error while retrieving stock' };
  }
}

/**
 * Validate cart items against current stock levels
 */
export async function validateCartStockAction(cartItems: Array<{
  productId: string;
  variantId: string;
  quantity: number;
}>): Promise<ActionResponse<{
  isValid: boolean;
  stockValidation: Array<{
    productId: string;
    availableStock: number;
    requestedQuantity: number;
    isValid: boolean;
    errorMessage?: string;
  }>;
}>> {
  if (!cartItems || cartItems.length === 0) {
    return { 
      success: true, 
      data: { isValid: true, stockValidation: [] } 
    };
  }

  const supabase = createServerActionClient();

  try {
    const productQuantities = cartItems.reduce((acc, item) => {
      acc[item.productId] = (acc[item.productId] || 0) + item.quantity;
      return acc;
    }, {} as Record<string, number>);

    const productIds = Object.keys(productQuantities);

    const { data: stockData, error } = await supabase
      .from('products')
      .select('id, stock_quantity')
      .in('id', productIds)
      .eq('is_active', true);

    if (error) {
      console.error('[Stock Validation Error] Failed to validate cart:', error);
      return { success: false, error: 'Failed to validate cart stock' };
    }

    const stockValidation = stockData?.map(product => {
      const requestedQuantity = productQuantities[product.id];
      const availableStock = product.stock_quantity || 0;
      const isValid = availableStock >= requestedQuantity;
      
      return {
        productId: product.id,
        availableStock,
        requestedQuantity,
        isValid,
        errorMessage: !isValid 
          ? `Insufficient stock: available ${availableStock}, requested ${requestedQuantity}`
          : undefined
      };
    }) || [];

    const isValid = stockValidation.every(item => item.isValid);

    return {
      success: true,
      data: {
        isValid,
        stockValidation
      }
    };
  } catch (error) {
    console.error('[Stock Validation Error] Exception:', error);
    return { success: false, error: 'Unexpected error during stock validation' };
  }
}

/**
 * Get stock levels for multiple products
 */
export async function getMultipleProductStockAction(productIds: string[]): Promise<ActionResponse<{
  stockLevels: Record<string, number>;
}>> {
  if (!productIds || productIds.length === 0) {
    return { 
      success: true, 
      data: { stockLevels: {} } 
    };
  }

  const supabase = createServerActionClient();

  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, stock_quantity')
      .in('id', productIds)
      .eq('is_active', true);

    if (error) {
      console.error('[Multiple Stock Error] Failed to get stock levels:', error);
      return { success: false, error: 'Failed to retrieve stock levels' };
    }

    const stockLevels = data.reduce((acc, product) => {
      acc[product.id] = product.stock_quantity || 0;
      return acc;
    }, {} as Record<string, number>);

    return {
      success: true,
      data: { stockLevels }
    };
  } catch (error) {
    console.error('[Multiple Stock Error] Exception:', error);
    return { success: false, error: 'Unexpected error while retrieving stock levels' };
  }
} 