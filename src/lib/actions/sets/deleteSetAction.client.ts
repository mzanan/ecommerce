'use client';

import { createClient } from "@/lib/supabase/client";
import type { ActionResponse } from '@/types/actions';

export async function deleteSetAction(id: string): Promise<ActionResponse<null>> {
    const supabase = createClient();
    
    try {
        const { error: imagesError } = await supabase
            .from('set_images')
            .delete()
            .eq('set_id', id);

        if (imagesError) {
            return { success: false, error: `Failed to delete set images: ${imagesError.message}` };
        }

        const { error: productsError } = await supabase
            .from('set_products')
            .delete()
            .eq('set_id', id);

        if (productsError) {
            return { success: false, error: `Failed to delete set products: ${productsError.message}` };
        }

        const { error: setError } = await supabase
            .from('sets')
            .delete()
            .eq('id', id);

        if (setError) {
            return { success: false, error: `Failed to delete set: ${setError.message}` };
        }

        return { success: true, data: null };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return { success: false, error: message };
    }
} 