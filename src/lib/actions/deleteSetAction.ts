'use server';

import { createServerActionClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from 'next/cache';
import type { ActionResponse as BaseActionResponse } from '@/types/actions';
import { deleteCollectionImage } from '@/lib/helpers/storageHelpers';

export async function deleteSetAction(setId: string): Promise<BaseActionResponse> {
    const supabase = createServerActionClient();
    let setSlug: string | null = null;

    try {
        const { data: set, error: fetchError } = await supabase
            .from('sets')
            .select(`
                slug,
                set_images ( id, image_url )
            `)
            .eq('id', setId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
             console.error(`[Server Action Error] Delete Set ${setId}: Fetch error`, fetchError);
             return { success: false, error: `Fetch error: ${fetchError.message}` };
        }
        if (!set) {
            console.warn(`[Server Action Warn] Delete Set: Set ${setId} not found (or already deleted). Revalidating anyway.`);
            revalidateTag('sets');
            revalidatePath('/admin/sets');
            return { success: true, message: 'Set already deleted or not found.' };
        }
        
        setSlug = set.slug;
        const imagesToDelete: { id: string; image_url: string }[] = (set.set_images as any[]) || [];
        const imageIdsToDelete = imagesToDelete.map(img => img.id);
        const imageUrlsToDelete = imagesToDelete.map(img => img.image_url);

        if (imageUrlsToDelete.length > 0) {
            const deleteStoragePromises = imageUrlsToDelete.map(url => deleteCollectionImage(url));
            const storageResults = await Promise.allSettled(deleteStoragePromises);
            storageResults.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.warn(`[Server Action Warn] Delete Set ${setId}: Failed to delete image ${imageUrlsToDelete[index]} from storage:`, result.reason);
                }
            });
        }

        if (imageIdsToDelete.length > 0) {
            const { error: dbImageDeleteError } = await supabase
                .from('set_images')
                .delete()
                .in('id', imageIdsToDelete);
            
            if (dbImageDeleteError) {
                 console.warn(`[Server Action Warn] Delete Set ${setId}: Failed to delete image records from DB: ${dbImageDeleteError.message}. Continuing to delete Set.`);
            }
        }

        const { error: deleteSetError } = await supabase
            .from('sets')
            .delete()
            .eq('id', setId);

        if (deleteSetError) {
            console.error(`[Server Action Error] Delete Set ${setId} DB Error:`, deleteSetError.message);
            return { success: false, error: `Failed to delete set: ${deleteSetError.message}` };
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
        const typedError = error instanceof Error ? error : new Error('Unknown error during set deletion');
        console.error(`[Server Action Error] Unexpected Delete Set ${setId}:`, typedError.message);
        return { success: false, error: `Error deleting set: ${typedError.message}` };
    }
} 