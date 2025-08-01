'use server';

import { createServerActionClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from 'next/cache';
import type { ActionResponse as BaseActionResponse } from '@/types/actions'; 
import type { ProductPositionData } from '@/types/sets';

/**
 * Updates the positions of products within a set.
 * Accepts a set ID and a JSON string of products with their new positions.
 *
 * @param setId - The UUID of the set to update.
 * @param productsJson - A JSON string representing an array of objects, each with 'id' (product ID) and 'position'.
 * @returns ActionResponse indicating success or failure.
 */
export async function updateSetProductsAction(
    setId: string,
    productsJson: string
): Promise<BaseActionResponse> {
    const supabase = createServerActionClient();

    if (!setId) {
        console.error('[Server Action Error] UpdateSetProducts: Set ID is required.');
        return { success: false, error: 'Set ID is required.' };
    }

    let products: ProductPositionData[];
    try {
        products = JSON.parse(productsJson);
        if (!Array.isArray(products)) {
            throw new Error('Input is not an array.');
        }
        products.forEach((p, index) => {
            if (typeof p.id !== 'string' || typeof p.position !== 'number' || p.position < 0) {
                 throw new Error(`Invalid data for product at index ${index}: id must be string, position must be non-negative number.`);
            }
        });
    } catch (e) {
        const error = e instanceof Error ? e : new Error('Unknown parsing error');
        console.error(`[Server Action Error] UpdateSetProducts (${setId}): Invalid JSON input`, error.message);
        return { success: false, error: `Invalid products data format: ${error.message}` };
    }

    try {
        const { error: transactionError } = await supabase.rpc('update_set_product_positions', {
            _set_id: setId,
            _products_data: products 
        });

        if (transactionError) {
            console.error(`[Server Action Error] UpdateSetProducts (${setId}): Transaction failed`, transactionError);
            throw new Error(`Database transaction failed: ${transactionError.message}`);
        }
        
        revalidateTag(`set-${setId}-products`);
        revalidatePath(`/admin/sets/${setId}/edit`); 

        return { success: true, message: 'Product positions updated successfully.' };

    } catch (error) {
        const typedError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`[Server Action Error] UpdateSetProducts (${setId}): Caught Exception`, typedError);
        return { success: false, error: `Failed to update product positions: ${typedError.message}` };
    }
}
