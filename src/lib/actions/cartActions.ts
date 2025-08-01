'use server';

import { createServerActionClient } from "@/lib/supabase/server";
import type { ActionResponse } from '@/types/actions';
import type { CartActionResult, CartUpdateResult, CurrentCartItem } from '@/types/cart';
import { getCurrentStockAction } from './stockActions';

/**
 * Server action to validate adding an item to the cart against stock.
 * It checks if the requested quantity for a specific variant is available, considering
 * the total stock shared across all variants of the same product.
 *
 * @param variantId - The ID of the product variant.
 * @param quantity - The quantity requested.
 * @param currentCartItems - Array of current cart items to calculate used stock.
 * @returns ActionResponse indicating success (if stock is available) or failure.
 */
export async function addItemToCartAction(
    variantId: string,
    quantity: number,
    currentCartItems?: CurrentCartItem[]
): Promise<ActionResponse<CartActionResult>> {
    if (!variantId) return { success: false, error: 'Variant ID is required.' };
    if (isNaN(quantity) || quantity < 1) return { success: false, error: 'Invalid quantity.' };

    const supabase = createServerActionClient();

    try {
        const { data: variantData, error: variantFetchError } = await supabase
            .from('product_variants')
            .select('product_id, size_name') 
            .eq('id', variantId)
            .single();

        if (variantFetchError || !variantData) {
            console.error(`[Server Action Error] addItemToCartAction - Variant fetch failed (variantId: ${variantId}):`, variantFetchError);
            return { success: false, error: 'Product variant not found.' };
        }

        const { data: productData, error: productFetchError } = await supabase
            .from('products')
            .select('name, slug, stock_quantity')
            .eq('id', variantData.product_id)
            .single();

        if (productFetchError || !productData || !productData.slug || !productData.name) {
            console.error(`[Server Action Error] addItemToCartAction - Product details fetch failed (productId: ${variantData.product_id}):`, productFetchError);
            return { success: false, error: 'Failed to retrieve product details.' };
        }

        const productName = productData.name;
        const productSize = variantData.size_name || 'N/A';

        const stockResult = await getCurrentStockAction(variantData.product_id);
        if (!stockResult.success) {
            return { success: false, error: 'Failed to check stock availability' };
        }

        const currentStock = stockResult.data?.availableStock || 0;

        let usedStockByAllVariantsInCart = 0;
        if (currentCartItems && Array.isArray(currentCartItems)) {
            usedStockByAllVariantsInCart = currentCartItems
                .filter(item => item.productId === variantData.product_id)
                .reduce((sum, item) => sum + item.quantity, 0);
        }

        const effectiveStockForThisAdd = Math.max(0, currentStock - usedStockByAllVariantsInCart);

        if (effectiveStockForThisAdd < quantity) {
             console.warn(`[Server Action Warn] addItemToCartAction - Insufficient stock for ${productName} (Size: ${productSize}, VariantId: ${variantId}). Requested: ${quantity}, Effective Available: ${effectiveStockForThisAdd} (Total Product Stock: ${currentStock}, Used by all variants in cart: ${usedStockByAllVariantsInCart})`);
            return {
                success: false,
                error: `Not enough stock for ${productName} (Size: ${productSize}). Only ${effectiveStockForThisAdd} effectively available. Other sizes/items of this product in cart are using ${usedStockByAllVariantsInCart} units of the total ${currentStock}.`,
            };
        }
        
        const successMessage = `${productName} (Size: ${productSize}) has been added to your cart.`;
        
        return {
            success: true,
            message: successMessage,
            data: { 
                productId: variantData.product_id, 
                size: variantData.size_name,
                slug: productData.slug,
                productName: productName,
                validatedQuantity: quantity,
                availableStock: currentStock
            },
        };

    } catch (error) {
        const typedError = error instanceof Error ? error : new Error('Unknown error during stock validation');
        console.error(`[Server Action Error] addItemToCartAction - Exception (variantId: ${variantId}):`, typedError);
        return { success: false, error: `Server error: ${typedError.message}` };
    }
} 

/**
 * Server action to validate and update the quantity of an item already in the cart.
 * It checks if the requested quantity for a specific variant is available, considering
 * the total stock shared across all variants of the same product.
 *
 * @param variantId - The ID of the product variant.
 * @param newQuantity - The new desired quantity.
 * @param currentCartItems - Array of current cart items to calculate used stock.
 * @returns ActionResponse indicating success or failure, and the validated quantity.
 */
export async function updateCartItemQuantityAction(
    variantId: string,
    newQuantity: number,
    currentCartItems?: CurrentCartItem[]
): Promise<ActionResponse<CartUpdateResult>> {
    if (!variantId) return { success: false, error: 'Variant ID is required.' };
    if (isNaN(newQuantity) || newQuantity < 0) {
        return { success: false, error: 'Invalid quantity.' };
    }

    const supabase = createServerActionClient();

    try {
        const { data: variantData, error: variantFetchError } = await supabase
            .from('product_variants')
            .select('product_id, size_name')
            .eq('id', variantId)
            .single();

        if (variantFetchError || !variantData) {
            console.error(`[Server Action Error] updateCartItemQuantityAction - Variant fetch failed (variantId: ${variantId}):`, variantFetchError);
            return { success: false, error: 'Product variant not found.' };
        }

        const { data: productData, error: productFetchError } = await supabase
            .from('products')
            .select('name') 
            .eq('id', variantData.product_id)
            .single();
        
        if (productFetchError || !productData) {
            console.error(`[Server Action Error] updateCartItemQuantityAction - Product details fetch failed (productId: ${variantData.product_id}):`, productFetchError);
            return { success: false, error: 'Failed to retrieve product details.' };
        }

        const stockResult = await getCurrentStockAction(variantData.product_id);
        if (!stockResult.success) {
            return { success: false, error: 'Failed to check stock availability' };
        }

        const currentStock = stockResult.data?.availableStock || 0;
        const productName = productData.name;
        const productSize = variantData.size_name || 'N/A';

        let usedStockByOtherVariantsInCart = 0;
        if (currentCartItems && Array.isArray(currentCartItems)) {
            usedStockByOtherVariantsInCart = currentCartItems
                .filter(item => item.productId === variantData.product_id && item.variantId !== variantId)
                .reduce((sum, item) => sum + item.quantity, 0);
        }

        const effectiveStockForProduct = Math.max(0, currentStock - usedStockByOtherVariantsInCart);

        if (newQuantity === 0) { 
            return {
                success: true,
                message: `${productName} (Size: ${productSize}) removed from your cart.`,
                data: { validatedQuantity: 0, availableStock: currentStock, productName, size: variantData.size_name },
            };
        }

        if (effectiveStockForProduct < newQuantity) {
            console.warn(`[Server Action Warn] updateCartItemQuantityAction - Insufficient stock for ${productName} (Size: ${productSize}, VariantId: ${variantId}). Requested: ${newQuantity}, Effective Available: ${effectiveStockForProduct} (Total Product Stock: ${currentStock}, Used by other variants: ${usedStockByOtherVariantsInCart}). Setting to max effective.`);
            return {
                success: true, 
                message: `Quantity for ${productName} (Size: ${productSize}) adjusted to ${effectiveStockForProduct} due to limited stock. Other sizes of this product are using ${usedStockByOtherVariantsInCart} units of the total ${currentStock}.`,
                data: { validatedQuantity: effectiveStockForProduct, availableStock: currentStock, productName, size: variantData.size_name },
            };
        }

        return {
            success: true,
            message: `Quantity for ${productName} (Size: ${productSize}) updated to ${newQuantity}.`,
            data: { validatedQuantity: newQuantity, availableStock: currentStock, productName, size: variantData.size_name },
        };

    } catch (error) {
        const typedError = error instanceof Error ? error : new Error('Unknown error during stock validation for update');
        console.error(`[Server Action Error] updateCartItemQuantityAction - Exception (variantId: ${variantId}):`, typedError);
        return { success: false, error: `Server error: ${typedError.message}` };
    }
} 