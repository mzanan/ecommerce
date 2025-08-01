'use server';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { uploadAboutImage, deleteFileByPath, getStoragePathFromUrl } from '@/lib/helpers/storageHelpers';
import type { AboutContentData, UploadedImageInfo } from '@/types/about';
import { APP_SETTINGS_ABOUT_KEY } from '@/lib/constants/home';

const getSupabaseAdminClient = () => {
    return createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function fetchAboutContentAction(): Promise<{ data: AboutContentData | null; error: string | null }> {
    const supabase = getSupabaseAdminClient();
    try {
        const { data: settingsData, error: settingsError } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', APP_SETTINGS_ABOUT_KEY)
            .maybeSingle();

        if (settingsError) throw settingsError;

        if (settingsData && settingsData.value && typeof settingsData.value === 'string') {
            try {
                const content = JSON.parse(settingsData.value) as AboutContentData;
                return {
                    data: {
                        text_content: content.text_content || null,
                        image_urls: Array.isArray(content.image_urls) ? content.image_urls.filter(img => typeof img === 'string' || img === null) : [],
                        image_aspect_ratio: content.image_aspect_ratio || 'square',
                    },
                    error: null,
                };
            } catch (parseError: any) {
                console.error("[Server Action Error] fetchAboutContentAction - JSON parse error:", parseError);
                return { data: { text_content: null, image_urls: [], image_aspect_ratio: 'square' }, error: "Failed to parse about content data." };
            }
        } else {
            return { data: { text_content: null, image_urls: [], image_aspect_ratio: 'square' }, error: null };
        }
    } catch (error: any) {
        console.error("[Server Action Error] fetchAboutContentAction:", error);
        return { data: null, error: `Failed to load about content: ${error.message || error}` };
    }
}



export async function saveAboutContentAction(
    formData: FormData
): Promise<{ success: boolean; error: string | null; data?: AboutContentData }> {

    const supabase = getSupabaseAdminClient();
    let uploadedImagePathsToRollback: string[] = [];

    const envBucketName = process.env.SUPABASE_BUCKET;
    if (!envBucketName) {
        const errorMessage = "Error: SUPABASE_BUCKET environment variable is not set.";
        console.error(errorMessage);
        return { success: false, error: `Server configuration error: ${errorMessage}` };
    }

    try {
        const text_content = formData.get('text_content') as string || null;
        const imageOrderJson = formData.get('imageOrder') as string;
        const deleteImageIds = formData.getAll('deleteImageIds') as string[];
        const newImageFiles = formData.getAll('images') as File[];
        const image_aspect_ratio = formData.get('image_aspect_ratio') as 'square' | 'portrait' | 'video' || 'square';


        if (!text_content || text_content.trim() === '') {
            return { success: false, error: "Text content is required." };
        }

        if (!imageOrderJson) {
            throw new Error("Image order information is missing.");
        }
        const imageOrder: string[] = JSON.parse(imageOrderJson);
        
        let oldImageUrls: string[] = [];
        const { data: currentAboutSettings } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', APP_SETTINGS_ABOUT_KEY)
            .maybeSingle();

        if (currentAboutSettings?.value && typeof currentAboutSettings.value === 'string') {
            try {
                const currentContent = JSON.parse(currentAboutSettings.value) as AboutContentData;
                if (Array.isArray(currentContent.image_urls)) {
                    oldImageUrls = currentContent.image_urls.filter((url): url is string => typeof url === 'string');
                }
            } catch {
                console.warn("[saveAboutContentAction] Could not parse existing about content from app_settings for image comparison.");
            }
        }
        
        let existingImageUrlsCount = oldImageUrls.filter(url => !deleteImageIds.includes(url)).length;

        if (newImageFiles.length === 0 && existingImageUrlsCount === 0 && imageOrder.filter(id => !id.startsWith('temp-') && !deleteImageIds.includes(id)).length === 0) {
             const finalOrderedNonTempImages = imageOrder.filter(id => !id.startsWith('temp-') && !deleteImageIds.includes(id));
             if (newImageFiles.length === 0 && finalOrderedNonTempImages.length === 0) {
                return { success: false, error: "At least one image is required." };
             }
        }

        const uploadedImagesMap = new Map<string, UploadedImageInfo>();

        if (newImageFiles.length > 0) {
            const uploadPromises = newImageFiles.map(async (file) => {
                const clientFileName = file.name; 
                const tempIdMatch = clientFileName.match(/^(temp-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}))___/i);
                const tempId = tempIdMatch ? tempIdMatch[1] : null;
                
                if (!tempId) {
                    console.warn(`[saveAboutContentAction] Could not extract tempId from filename: ${clientFileName}. Skipping this file.`);
                    throw new Error(`Internal error: TempId missing for file ${clientFileName}. Ensure file was processed correctly on the client.`);
                }

                const uploadResult = await uploadAboutImage(file);
                if (uploadResult.error || !uploadResult.publicUrl || !uploadResult.path) {
                    throw new Error(uploadResult.error || `Failed to upload image ${file.name}`);
                }
                uploadedImagesMap.set(tempId, { tempId, url: uploadResult.publicUrl, path: uploadResult.path });
                uploadedImagePathsToRollback.push(uploadResult.path);
            });
            await Promise.all(uploadPromises);
        }
        
        const finalImageUrls: string[] = imageOrder.map(idOrTempId => {
            if (idOrTempId.startsWith('temp-')) {
                const uploaded = uploadedImagesMap.get(idOrTempId);
                if (!uploaded) {
                    throw new Error(`Could not find uploaded image data for tempId: ${idOrTempId}. This might happen if upload failed or tempId mismatch.`);
                }
                return uploaded.url;
            }
            return idOrTempId; 
        });

        if (finalImageUrls.filter(url => url !== null && url !== undefined).length === 0) {
            return { success: false, error: "At least one image is required after processing." };
        }

        const finalUrlsSet = new Set(finalImageUrls);
        const imagesToDeleteFromStoragePaths: string[] = [];

        for (const idToDelete of deleteImageIds) {
            const storagePath = getStoragePathFromUrl(idToDelete, envBucketName);
            if (storagePath) {
                 imagesToDeleteFromStoragePaths.push(storagePath);
            }
        }
        
        for (const oldUrl of oldImageUrls) {
            if (!finalUrlsSet.has(oldUrl) && !deleteImageIds.includes(oldUrl)) {
                const storagePath = getStoragePathFromUrl(oldUrl, envBucketName);
                if (storagePath) {
                    imagesToDeleteFromStoragePaths.push(storagePath);
                }
            }
        }
        
        const uniquePathsToDelete = Array.from(new Set(imagesToDeleteFromStoragePaths));
        if (uniquePathsToDelete.length > 0) {
            const deletePromises = uniquePathsToDelete.map(path => deleteFileByPath(path));
            const deleteResults = await Promise.allSettled(deletePromises);
            deleteResults.forEach(result => {
                if (result.status === 'rejected') console.warn(`Failed to delete an old image from storage: ${result.reason}`);
            });
        }

        const newDbContentData: AboutContentData = {
            text_content: text_content,
            image_urls: finalImageUrls,
            image_aspect_ratio: image_aspect_ratio,
        };

        const newDbContentJson = JSON.stringify(newDbContentData);

        const { error: upsertError } = await supabase
            .from('app_settings')
            .upsert({ key: APP_SETTINGS_ABOUT_KEY, value: newDbContentJson }, { onConflict: 'key' });

        if (upsertError) throw upsertError;
        
        return { success: true, error: null, data: newDbContentData };

    } catch (_e) {
        console.error('Error updating about content:', _e);
        return { success: false, error: 'Failed to update about content' };
    }
} 