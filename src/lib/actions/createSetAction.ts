'use server';

import { createServerActionClient } from '@/lib/supabase/server';
import { createSetFormSchema } from '@/lib/schemas/setSchema';
import { revalidatePath } from 'next/cache';
import { uploadCollectionImage, deleteCollectionImage } from '@/lib/helpers/storageHelpers';
import slugify from 'slugify';
import type { ActionResponse as BaseActionResponse } from '@/types/actions';
import type { SetRow } from '@/types/db';

export async function createSetAction(
    formData: FormData
): Promise<BaseActionResponse<SetRow>> {
    const supabase = createServerActionClient();

    const { data: session } = await supabase.auth.getSession();
    if (!session || !session.session?.user) {
        return { success: false, error: 'User not authenticated.' };
    }

    const { extractImageFilesFromFormData } = require('@/lib/helpers/formHelpers');
    const imageFiles = extractImageFilesFromFormData(formData);
    const rawData = {
        name: formData.get('name'),
        slug: formData.get('slug') || null,
        description: formData.get('description') || '', 
        type: formData.get('type'),
        layout_type: formData.get('layout_type'),
        is_active: formData.get('is_active') === 'on',
        images: imageFiles,
    };

    const validationResult = createSetFormSchema.safeParse(rawData);

    if (!validationResult.success) {
        if (validationResult.error.flatten().fieldErrors.is_active) {
             console.error("Zod still complaining about is_active unexpectedly!");
        }
        const errorDetail = JSON.stringify(validationResult.error.flatten().fieldErrors);
        console.error('[Server Action Error] Create Set Validation:', { error: errorDetail });
        return { success: false, error: `Validation failed: ${errorDetail}` };
    }

    const {
        images,
        slug: providedSlug, 
        name, 
        type, 
        layout_type,
        is_active,
        ...validatedSetData
    } = validationResult.data;
    
    const finalSlug = providedSlug || slugify(name, { lower: true, strict: true });

    const uploadedImageResults: Array<{ publicUrl: string; path: string }> = [];
    const uploadedImagePaths: string[] = [];
    let createdSetId: string | null = null;

    try {
        for (const imageFile of images) {
            const uploadResult = await uploadCollectionImage(imageFile);
            if (uploadResult.error || !uploadResult.publicUrl || !uploadResult.path) {
                 throw new Error(`Image upload failed: ${uploadResult.error || 'Unknown path'} for file ${imageFile.name}`);
            }
            uploadedImageResults.push({ publicUrl: uploadResult.publicUrl, path: uploadResult.path });
            uploadedImagePaths.push(uploadResult.path);
        }

        const { data: newSet, error: insertSetError } = await supabase
            .from('sets')
            .insert({ 
                ...validatedSetData,
                name, 
                slug: finalSlug, 
                type, 
                layout_type,
                is_active 
            })
            .select('id, slug') 
            .single();

        if (insertSetError) {
            console.error('DB Set Insert failed:', insertSetError);
             throw new Error(insertSetError.message);
        }
        if (!newSet?.id) {
            throw new Error("Set created but ID not returned.");
        }
        createdSetId = newSet.id;
        const imageInsertPromises = uploadedImageResults.map((img, index) => 
            supabase.from('set_images').insert({
                set_id: createdSetId!, 
                image_url: img.publicUrl,
                position: index 
            })
        );
        const imageInsertResults = await Promise.allSettled(imageInsertPromises);
        
        const failedImageInserts = imageInsertResults.filter(r => r.status === 'rejected');
        if (failedImageInserts.length > 0) {
            console.error('Failed to insert some set_images records:', failedImageInserts);
             throw new Error(`Failed to save ${failedImageInserts.length} image records to database.`);
        }

        revalidatePath('/admin/sets');
        revalidatePath('/'); 
        if(newSet.slug){
            revalidatePath(`/set/${newSet.slug}`);
        }

        return { success: true, message: 'Set created successfully', data: { id: createdSetId, slug: newSet.slug } as any };

    } catch (error) {
        console.error('Set Creation Action Error:', error);
        if (uploadedImagePaths.length > 0) {
             console.warn(`Rolling back ${uploadedImagePaths.length} image uploads...`);
             const deletePromises = uploadedImagePaths.map(path => deleteCollectionImage(path));
             await Promise.allSettled(deletePromises);
        }
        if (createdSetId) {
            console.warn(`Attempting to delete set record ${createdSetId}...`);
            await supabase.from('sets').delete().eq('id', createdSetId);
        }
        
        const typedError = error instanceof Error ? error : new Error('Unknown error');
        if (typedError.message.includes('duplicate key value violates unique constraint "sets_slug_key"')){
             return { success: false, error: `Set slug '${finalSlug}' already exists.` };
        }
        return { success: false, error: `Error creating set: ${typedError.message}` };
    }
} 