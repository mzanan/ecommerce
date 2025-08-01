'use server';

import { createServerActionClient } from '@/lib/supabase/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import type { ActionResponse } from '@/types/actions';

/**
 * Removes a product from a specific set.
 * @param setId The ID of the set.
 * @param productId The ID of the product to remove.
 * @returns ActionResponse indicating success or failure.
 */
export async function removeProductFromSetAction(setId: string, productId: string): Promise<ActionResponse> {
    if (!setId || !productId) {
        return { success: false, error: 'Set ID and Product ID are required.' };
    }

    const supabase = createServerActionClient();
    try {
        const { error } = await supabase.from('set_products')
            .delete().eq('set_id', setId).eq('product_id', productId);
        if (error) throw new Error(error.message);

        revalidateTag(`set-${setId}-products`);
        revalidatePath(`/admin/sets/${setId}/edit`);
        return { success: true, message: `Product ${productId} removed` };

    } catch (error) {
        console.error('Error removing product from set:', error);
        const typedError = error instanceof Error ? error : new Error('Unknown error');
        return { success: false, error: `Failed to remove product: ${typedError.message}` };
    }
} 