'use server';

import { createServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from 'next/cache';
import { uploadCollectionImage, deleteCollectionImage } from '@/lib/helpers/storageHelpers';
import { updateSetFormSchema } from '@/lib/schemas/setSchema';
import type { ActionResponse } from '@/types/actions';
import type { SetImageRow } from '@/types/setActions';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

async function handleSetImageUploads(
    supabase: SupabaseClient<Database>,
    setId: string,
    formData: FormData,
    deleteImageIds: string[] = []
): Promise<ActionResponse> {
    const imageFiles = formData.getAll('images').filter(img => img instanceof File && img.size > 0) as File[];
    const imageOrderJson = formData.get('imageOrder') as string;
    const finalImageOrderIds: string[] = imageOrderJson ? JSON.parse(imageOrderJson) : [];
    const uploadedImagesData: Array<{ publicUrl: string | null; path: string | null; tempId?: string | null; error: string | null }> = [];
    
    if (deleteImageIds && deleteImageIds.length > 0) {
        const { error: deleteError } = await supabase
            .from('set_images')
            .delete()
            .in('id', deleteImageIds);
        if (deleteError) throw new Error(`Failed to delete images: ${deleteError.message}`);
    }

    try {
        if (imageFiles.length > 0) {
            const uploadPromises = imageFiles.map(async (file) => {
                const matches = Array.from(file.name.matchAll(/(temp-[0-9a-fA-F-]+)___/g));
                let tempId = null;
                for (const match of matches) {
                    tempId = match[1];
                }
                
                if (!tempId) {
                    console.warn(`[updateSetAction] Could not extract tempId from filename: ${file.name}`);
                    tempId = `temp-${uuidv4()}`;
                }
                
                const uploadResult = await uploadCollectionImage(file);
                return { ...uploadResult, tempId: tempId };
            });
            const results = await Promise.allSettled(uploadPromises);
            
            const successfulUploads: typeof uploadedImagesData = [];
            const failedUploads: string[] = [];
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && !result.value.error) {
                    successfulUploads.push(result.value);
                } else {
                    const fileName = imageFiles[index]?.name || `file-${index}`;
                    const errorMsg = result.status === 'rejected' 
                        ? result.reason 
                        : result.value.error;
                    failedUploads.push(`${fileName}: ${errorMsg}`);
                    console.error("Set image upload failed:", fileName, errorMsg);
                }
            });
            
            if (failedUploads.length > 0) {
                const pathsToRollback = successfulUploads.filter(d => d.path).map(d => d.path as string);
                if (pathsToRollback.length > 0) await Promise.allSettled(pathsToRollback.map(path => deleteCollectionImage(path)));
                return { success: false, error: `Failed to upload ${failedUploads.length} image(s): ${failedUploads.join(', ')}` };
            }
            
            uploadedImagesData.push(...successfulUploads);
        }
        
        if (uploadedImagesData.length > 0) {
            const { data: existingImages, error: fetchExistingError } = await supabase
                .from('set_images').select('id, position, image_url').eq('set_id', setId);
            if (fetchExistingError) throw new Error(`Failed to fetch existing images for position update: ${fetchExistingError.message}`);
            const existingImageMap = new Map((existingImages || []).map(img => [img.id, img]));
            const existingUrlSet = new Set((existingImages || []).map(img => img.image_url));

            const insertData: Omit<SetImageRow, 'id' | 'created_at' | 'alt_text'>[] = [];
            const updateData: Pick<SetImageRow, 'id' | 'position'>[] = [];

            if (finalImageOrderIds.length > 0) {
                finalImageOrderIds.forEach((id, index) => {
                    if (id.startsWith('temp-')) {
                        const uploaded = uploadedImagesData.find(img => img.tempId === id);
                        
                        if (uploaded?.publicUrl) {
                            if (!existingUrlSet.has(uploaded.publicUrl)) {
                                const insertRecord = { set_id: setId, image_url: uploaded.publicUrl, position: index };
                                insertData.push(insertRecord);
                            }
                        }
                    } else {
                        const existing = existingImageMap.get(id);
                        if (existing && existing.position !== index) {
                            const updateRecord = { id: id, position: index };
                            updateData.push(updateRecord);
                        }
                    }
                });
            } else {
                uploadedImagesData.forEach((uploaded, index) => {
                    if (uploaded?.publicUrl) {
                        if (!existingUrlSet.has(uploaded.publicUrl)) {
                            const insertRecord = { set_id: setId, image_url: uploaded.publicUrl, position: index };
                            insertData.push(insertRecord);
                        }
                    }
                });
            }

            if (insertData.length > 0) {
                const { error: insertError } = await supabase.from('set_images').insert(insertData);
                if (insertError) throw new Error(`Failed to insert new images: ${insertError.message}`);
            }

            if (updateData.length > 0) {
                for (const update of updateData) {
                    const { error: updateError } = await supabase.from('set_images')
                        .update({ position: update.position }).eq('id', update.id);
                    if (updateError) throw new Error(`Failed to update image position: ${updateError.message}`);
                }
            }
        } else if (finalImageOrderIds.length > 0) {
            const { data: existingImages, error: fetchExistingError } = await supabase
                .from('set_images').select('id, position').eq('set_id', setId);
            if (fetchExistingError) throw new Error(`Failed to fetch existing images for reorder: ${fetchExistingError.message}`);
            
            const existingImageMap = new Map((existingImages || []).map(img => [img.id, img]));
            const updateData: Pick<SetImageRow, 'id' | 'position'>[] = [];

            finalImageOrderIds.forEach((id, index) => {
                const existing = existingImageMap.get(id);
                if (existing && existing.position !== index) {
                    updateData.push({ id: id, position: index });
                }
            });

            if (updateData.length > 0) {
                for (const update of updateData) {
                    const { error: updateError } = await supabase.from('set_images')
                        .update({ position: update.position }).eq('id', update.id);
                    if (updateError) throw new Error(`Failed to update image position: ${updateError.message}`);
                }
            }
        }
        return { success: true };
    } catch (error) {
        const typedError = error instanceof Error ? error : new Error('Unknown image handling error');
        console.error("Error in handleSetImageUploads:", typedError);
        return { success: false, error: typedError.message };
    }
}

export async function updateSetAction(
    setId: string,
    prevState: ActionResponse | null,
    formData: FormData
): Promise<ActionResponse<{id: string}>> {
    if (!setId) return { success: false, error: 'Set ID is missing.' };
    
    const supabase = createServerActionClient();
    
    const isActive = formData.get('is_active') === 'on';
    const showTitleOnHome = formData.get('show_title_on_home') === 'on';
    const imageFiles = formData.getAll('images').filter(img => img instanceof File && img.size > 0) as File[];

    const rawDataForValidation = {
        id: setId,
        name: formData.get('name'),
        slug: formData.get('slug') || undefined,
        description: formData.get('description') || '',
        is_active: isActive,
        show_title_on_home: showTitleOnHome,
        type: formData.get('type'),
        layout_type: formData.get('layout_type'),
        images: imageFiles,
    };

    const validatedFields = updateSetFormSchema.safeParse(rawDataForValidation);

    if (!validatedFields.success) {
        const errorDetail = JSON.stringify(validatedFields.error.flatten().fieldErrors);
        console.error("Update Set Validation Error:", errorDetail);
        return { success: false, error: `Validation failed: ${errorDetail}` };
    }

    const { name, slug, type, description, layout_type, is_active, show_title_on_home } = validatedFields.data;
    const deleteImageIds = formData.getAll('deleteImageIds').map(String);
    const newImageCount = imageFiles.length;

    const { count: existingImageCount, error: countError } = await supabase
        .from('set_images')
        .select('id', { count: 'exact', head: true })
        .eq('set_id', setId);

    if (countError) {
        return { success: false, message: 'Could not verify existing image count.', error: countError.message };
    }
    const finalImageCount = (existingImageCount ?? 0) - deleteImageIds.length + newImageCount;
    let requiredImages = 0;
    let errorMessage = '';
    switch (layout_type) {
        case 'SINGLE_COLUMN': requiredImages = 1; break;
        case 'SPLIT_SMALL_LEFT': case 'SPLIT_SMALL_RIGHT': requiredImages = 2; break;
        case 'STAGGERED_THREE': requiredImages = 3; break;
    }
    if (finalImageCount < requiredImages) {
        errorMessage = `${layout_type.replace(/_/g, ' ').toLowerCase()} layout requires at least ${requiredImages} image(s). After changes, there would be ${finalImageCount}.`;
        return { 
            success: false, 
            message: errorMessage, 
            error: JSON.stringify({ layout_type: [errorMessage] })
        };
    }

    const { error: updateError } = await supabase
        .from('sets')
        .update({
            name, slug, type, description, layout_type, is_active, show_title_on_home, updated_at: new Date().toISOString()
        })
        .eq('id', setId);

    if (updateError) {
        return { success: false, message: updateError.message || 'Failed to update set.', error: updateError.code === '23505' ? 'Slug already exists' : updateError.message };
    }

    const imageHandlingResult = await handleSetImageUploads(supabase, setId, formData, deleteImageIds);
    if (!imageHandlingResult.success) {
        return { success: false, message: `Set updated, but image processing failed: ${imageHandlingResult.message || imageHandlingResult.error || 'Unknown image error'}`, error: imageHandlingResult.error };
    }

    revalidatePath('/admin/sets');
    revalidatePath(`/admin/sets/${setId}/edit`);

    return { success: true, message: 'Set updated successfully.', data: { id: setId } };
} 