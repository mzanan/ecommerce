'use server';

import { createServerActionClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from 'next/cache';
import type { ActionResponse } from '@/types/actions';

export async function deleteSetAction(setId: string): Promise<ActionResponse> {
    const supabase = createServerActionClient();
    let setSlug: string | null = null;

    try {
        const { data: set, error: fetchError } = await supabase
            .from('sets')
            .select('slug') 
            .eq('id', setId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
             return { success: false, error: `Fetch error: ${fetchError.message}` };
        }
        if (!set) {
            return { success: true, message: 'Set already deleted or not found.' };
        }
        setSlug = set.slug;

        const { error: deleteError } = await supabase
            .from('sets')
            .delete()
            .eq('id', setId);

        if (deleteError) {
            return { success: false, error: `Failed to delete set: ${deleteError.message}` };
        }

        revalidateTag('sets');
        revalidatePath('/admin/sets');
        revalidatePath('/');
        if (setSlug) {
            revalidateTag(`set-${setSlug}`);
            revalidatePath(`/set/${setSlug}`);
        }

        return { success: true, message: 'Set deleted successfully' };

    } catch (error) {
        const typedError = error instanceof Error ? error : new Error('Unknown error');
        return { success: false, error: `Error deleting set: ${typedError.message}` };
    }
} 