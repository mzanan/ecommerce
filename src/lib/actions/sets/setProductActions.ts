'use server';

import { createServerActionClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from 'next/cache';
import slugify from 'slugify';
import type { ActionResponse } from '@/types/actions';
import type { SetRow } from '@/types/db';
import type { SelectOption } from '@/types/ui';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function addProductToSet(setId: string, productId: string): Promise<ActionResponse> {
    const supabase = createServerActionClient();
    try {
        const { data: maxPosData } = await supabase.from('set_products')
            .select('position').eq('set_id', setId)
            .order('position', { ascending: false, nullsFirst: false }).limit(1).single();
        const nextPosition = (maxPosData?.position ?? -1) + 1;

        const { error } = await supabase.from('set_products')
            .insert({ set_id: setId, product_id: productId, position: nextPosition });

        if (error) {
            if (error.code === '23505') return { success: false, error: 'Product is already in this set.' };
            throw new Error(error.message);
        }

        revalidateTag(`set-${setId}-products`);
        revalidatePath(`/admin/sets/${setId}/edit`);
        return { success: true, message: `Product ${productId} added` };

    } catch (error) {
        const typedError = error instanceof Error ? error : new Error('Unknown error');
        return { success: false, error: `Failed to add product: ${typedError.message}` };
    }
}

export async function getSetsForSelection(): Promise<ActionResponse<{ sets: SelectOption[] }>> {
    const supabase = createServerActionClient();
    try {
        const { data, error } = await supabase
            .from('sets')
            .select('id, name, type')
            .eq('is_active', true)  
            .order('name', { ascending: true }); 

        if (error) {
            return { success: false, error: "Failed to fetch sets." };
        }
        
        const sets = (data || []).map(c => ({
            value: c.id,
            label: c.name,
            group: c.type ?? 'Uncategorized' 
        }));

        return { success: true, data: { sets } };

    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error fetching sets';
        return { success: false, error: message };
    }
}

async function verifyAdmin(supabase: SupabaseClient<Database>): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { count } = await supabase
        .from('admin_users')
        .select('* ', { count: 'exact', head: true })
        .eq('id', user.id);
    return count === 1;
}

export async function updateSet(
    id: string,
    updates: Partial<Pick<SetRow, 'name' | 'description' | 'is_active' | 'type' | 'layout_type' | 'slug'>>
): Promise<{ success: boolean; message?: string; data?: SetRow }> {
    const supabase = createServerActionClient();

    if (!id) {
        return { success: false, message: 'Set ID is required.' };
    }

    const isAdmin = await verifyAdmin(supabase);
    if (!isAdmin) {
        return { success: false, message: 'Admin authorization required.' };
    }

    const validUpdates: Partial<SetRow> = { ...updates };

    if (validUpdates.name && !validUpdates.slug) {
        validUpdates.slug = slugify(validUpdates.name, { lower: true, strict: true });
    }
    
    validUpdates.updated_at = new Date().toISOString();

    if (Object.keys(validUpdates).length === 0) {
        return { success: true, message: 'No fields to update.' }; 
    }
    try {
        const { data, error } = await supabase
            .from('sets')
            .update(validUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
             if (error.code === '23505' && validUpdates.slug) { 
                 return { success: false, message: `Set slug '${validUpdates.slug}' already exists.` };
            } 
            throw error;
        }

        revalidateTag('sets');
        revalidatePath('/admin/sets');
        revalidatePath('/admin/home-design');
        revalidatePath('/');
        if(data?.slug){
            revalidateTag(`set-${data.slug}`);
            revalidatePath(`/set/${data.slug}`);
        }

        return { success: true, message: 'Set updated successfully.', data };

    } catch (error: any) {
        console.error("Error updating set:", error);
        return { success: false, message: `Database Error: ${error.message}` };
    }
} 