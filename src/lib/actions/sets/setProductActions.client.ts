'use client';

import { createClient } from "@/lib/supabase/client";
import type { ActionResponse } from '@/types/actions';
import type { SetRow, ProductWithPosition } from '@/types/db';
import type { ProductWithThumbnail, AvailableProductsResult } from '@/types/sets';
import { getProductsInSetAction } from '@/lib/queries/setQueries.server';

export async function updateSet(id: string, updates: Partial<SetRow>): Promise<ActionResponse<SetRow>> {
    const supabase = createClient();
    
    try {
        const { data, error } = await supabase
            .from('sets')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return { success: false, error: `Failed to update set: ${error.message}` };
        }

        return { success: true, data };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return { success: false, error: message };
    }
}

export async function getProductsInSet(setId: string): Promise<ActionResponse<{ products: ProductWithPosition[] }>> {
    return getProductsInSetAction(setId);
}

export async function getAvailableProductsForSetPaginated(): Promise<AvailableProductsResult> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from('products')
            .select('id, name, slug')
            .eq('is_active', true)
            .limit(10);

        if (error) {
            return { success: false, error: error.message };
        }

        const products: ProductWithThumbnail[] = (data || []).map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            thumbnail_url: null
        }));

        return {
            success: true,
            data: {
                products,
                count: products.length
            }
        };
    } catch (err) {
        console.error('[AVAILABLE_PRODUCTS] ERROR:', err);
        return { success: false, error: 'Query failed' };
    }
} 