'use server';

import { createServerActionClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from 'next/cache';
import { uploadCollectionImage } from '@/lib/helpers/storageHelpers';
import slugify from 'slugify';
import { createSetFormSchema } from '@/lib/schemas/setSchema';
import type { ActionResponse } from '@/types/actions';
import type { SetRow } from '@/types/db';
import type { UploadedSetImageInfo } from '@/types/setActions';

export async function createSetAction(
    prevState: ActionResponse | null,
    formData: FormData
): Promise<ActionResponse<SetRow>> {
    const supabase = createServerActionClient();
    let uploadedImagePathsToRollback: string[] = [];
    
    const isActive = formData.get('is_active') === 'on';
    const showTitleOnHome = formData.get('show_title_on_home') === 'on';
    const { extractImageFilesFromFormData } = require('@/lib/helpers/formHelpers');
    const newImageFiles = extractImageFilesFromFormData(formData);
    const imageOrderJson = formData.get('imageOrder') as string;

    const rawData = {
        name: formData.get('name'),
        slug: formData.get('slug') || null,
        description: formData.get('description') || '',
        is_active: isActive, 
        show_title_on_home: showTitleOnHome,
        type: formData.get('type'),
        layout_type: formData.get('layout_type'),
        images: newImageFiles,
    };

    const validationResult = createSetFormSchema.safeParse(rawData);

    if (!validationResult.success) {
        const errorDetail = JSON.stringify(validationResult.error.flatten().fieldErrors);
        return { success: false, error: `Validation failed: ${errorDetail}` };
    }

    if (!imageOrderJson) {
        return { success: false, error: "Image order information is missing." };
    }
    const imageOrderClient: string[] = JSON.parse(imageOrderJson);

    const { slug: providedSlug, name, type, layout_type, is_active, show_title_on_home, images: _images, imageOrderChanged: _imageOrderChanged, ...restOfValidatedData } = validationResult.data;
    const finalSlug = providedSlug || slugify(name, { lower: true, strict: true });

    const uploadedImagesMap = new Map<string, UploadedSetImageInfo>();
    let createdSetId: string | null = null;

    try {
        if (newImageFiles.length > 0) {
            const uploadPromises = newImageFiles.map(async (file: File) => {
                const clientFileName = file.name; 
                let tempId = null;
                
                try {
                    const matches = Array.from(clientFileName.matchAll(/(temp-[0-9a-fA-F-]+)___/g));
                    let lastMatch: RegExpMatchArray | null = null;
                    for (const match of matches) {
                        lastMatch = match;
                    }
                    if (lastMatch && lastMatch[1]) {
                        tempId = lastMatch[1];
                    }
                    
                    if (!tempId) {
                        console.warn(`[createSetAction] Could not extract tempId from filename: ${clientFileName} for set ${name}`);
                        throw new Error(`Internal error: TempId missing for file ${clientFileName}`);
                    }

                    const uploadResult = await uploadCollectionImage(file);
                    if (uploadResult.error || !uploadResult.publicUrl || !uploadResult.path) {
                        throw new Error(uploadResult.error || `Failed to upload image ${file.name}`);
                    }
                    uploadedImagesMap.set(tempId, { tempId, url: uploadResult.publicUrl, path: uploadResult.path });
                    uploadedImagePathsToRollback.push(uploadResult.path);
                    
                    return { success: true, tempId, file: clientFileName };
                } catch (uploadError: any) {
                    console.error(`[createSetAction] Upload failed for ${clientFileName}:`, uploadError.message);
                    return { success: false, tempId, file: clientFileName, error: uploadError.message };
                }
            });
            
            const results = await Promise.allSettled(uploadPromises);
            const failures: string[] = [];
            
            for (const result of results) {
                if (result.status === 'rejected') {
                    failures.push(`Upload promise rejected: ${result.reason}`);
                } else if (!result.value.success) {
                    failures.push(`${result.value.file}: ${result.value.error}`);
                }
            }
            
            if (failures.length > 0) {
                throw new Error(`Failed to upload ${failures.length} image(s): ${failures.join(', ')}`);
            }
        }

        const { data: newSet, error: insertError } = await supabase
            .from('sets')
            .insert({ ...restOfValidatedData, name, slug: finalSlug, type, layout_type, is_active, show_title_on_home })
            .select('id, slug')
            .single();

        if (insertError) {
            if (insertError.code === '23505') { 
                 return { success: false, error: `Set slug '${finalSlug}' already exists.` };
            } 
            throw insertError; 
        }
        if (!newSet?.id) {
             throw new Error("Set created but ID not returned from database.");
        }
        createdSetId = newSet.id;

        const finalImageRecords: Array<{set_id: string; image_url: string; position: number}> = [];
        if (uploadedImagesMap.size > 0) {
            if (imageOrderClient.length > 0) {
                imageOrderClient.forEach((idOrTempId, index) => {
                    if (idOrTempId.startsWith('temp-')) {
                        const uploaded = uploadedImagesMap.get(idOrTempId);
                        if (!uploaded) {
                            throw new Error(`Image data mismatch for ${idOrTempId}. Upload might have failed or tempId is incorrect.`);
                        }
                        const record = {
                            set_id: createdSetId!,
                            image_url: uploaded.url,
                            position: index
                        };
                        finalImageRecords.push(record);
                    }
                });
            } else {
                Array.from(uploadedImagesMap.values()).forEach((uploaded, index) => {
                    const record = {
                        set_id: createdSetId!,
                        image_url: uploaded.url,
                        position: index
                    };
                    finalImageRecords.push(record);
                });
            }
        }

        if (finalImageRecords.length > 0) {
            const { error: imageInsertError } = await supabase
                .from('set_images')
                .insert(finalImageRecords)
                .select();

            if (imageInsertError) throw imageInsertError;
        }

        if (createdSetId && is_active) {
            try {
                const { syncHomepageLayout } = await import('@/lib/actions/layoutActions');
                await syncHomepageLayout('/');
            } catch (layoutError: any) {
                console.error('[BROWSER DEBUG] Error during homepage layout sync:', layoutError);
            }
        } 

        revalidateTag('sets');
        revalidatePath('/admin/sets');
        revalidatePath('/admin/home-design');
        revalidatePath('/'); 
        if(newSet.slug){
            revalidateTag(`set-${newSet.slug}`);
            revalidatePath(`/set/${newSet.slug}`);
        }

        return { 
            success: true, 
            message: `Set "${name}" created successfully!`,
            data: { 
                id: createdSetId!, 
                slug: newSet.slug, 
                name: name 
            } as SetRow 
        };

    } catch (error: any) {
        console.error(`[Server Action Error] createSetAction - Exception (Set: ${name}):`, error.message);

        if (uploadedImagePathsToRollback.length > 0) {
            const { deleteFileByPath } = await import('@/lib/helpers/storageHelpers');
            const rollbackPromises = uploadedImagePathsToRollback.map(path => deleteFileByPath(path));
            await Promise.allSettled(rollbackPromises);
        }

        if (createdSetId) {
            try {
                await supabase.from('set_images').delete().eq('set_id', createdSetId);
                await supabase.from('sets').delete().eq('id', createdSetId);
            } catch (cleanupError: any) {
                console.error(`[Server Action Error] createSetAction - Cleanup failed for set ${createdSetId}:`, cleanupError.message);
            }
        }

        return { success: false, error: `Failed to create set: ${error.message}` };
    }
} 