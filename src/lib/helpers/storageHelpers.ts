import { createServerActionClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from 'uuid';

const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'infideli-images';

/**
 * Uploads a product image file to Supabase Storage.
 * @param file The image file to upload.
 * @returns Object containing publicUrl, path (for deletion), and error.
 */
export async function uploadProductImage(file: File): Promise<{ publicUrl: string | null, path: string | null, error: string | null }> {
    const supabase = createServerActionClient();
    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `products/${uniqueFileName}`;

    try {
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            console.error('[Storage Helper Error] Upload Product Image:', uploadError.message);
            return { publicUrl: null, path: null, error: `Storage upload failed: ${uploadError.message}` };
        }

        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(uploadData.path);
        
        return { publicUrl: urlData.publicUrl, path: uploadData.path, error: null };

    } catch (error) {
        const typedError = error instanceof Error ? error : new Error('Unknown storage error');
        console.error('[Storage Helper Error] Unexpected Upload Product Image:', typedError.message);
        return { publicUrl: null, path: null, error: `Unexpected storage error: ${typedError.message}` };
    }
}

/**
 * Deletes a product image from Supabase Storage using its full public URL.
 * @param imageUrl The full public URL of the image to delete.
 * @returns Object containing success status and error message.
 */
export async function deleteProductImage(imageUrl: string): Promise<{ success: boolean, error: string | null }> {
    const supabase = createServerActionClient();
    const bucketName = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_NAME || 'infideli-images';

    try {
        const url = new URL(imageUrl);
        const pathParts = url.pathname.split('/');
        const publicIndex = pathParts.indexOf('public');
        const bucketNameIndex = pathParts.indexOf(bucketName);

        if (publicIndex === -1 || bucketNameIndex === -1 || bucketNameIndex !== publicIndex + 1 || bucketNameIndex + 1 >= pathParts.length) {
             console.error(`[Storage Helper Error] Could not extract path. URL: ${imageUrl}, Bucket: ${bucketName}, Parts: ${pathParts.join(', ')}`);
            throw new Error('Could not extract file path from URL structure.');
        }

        const filePath = pathParts.slice(bucketNameIndex + 1).join('/');

        const { error: deleteError } = await supabase.storage
            .from(bucketName)
            .remove([filePath]);

        if (deleteError) {
            console.error(`[Storage Helper Error] Delete Product Image (${filePath}):`, deleteError.message);
            return { success: false, error: `Failed to delete image from storage: ${deleteError.message}` };
        }

        return { success: true, error: null };

    } catch (error) {
         const typedError = error instanceof Error ? error : new Error('Unknown error during image deletion');
        console.error(`[Storage Helper Error] Unexpected Delete Product Image (${imageUrl}):`, typedError.message);
        return { success: false, error: `Failed to delete product image due to storage error: ${typedError.message}` };
    }
}



/**
 * Uploads a set image file to Supabase Storage.
 * @param file The image file to upload.
 * @returns Object containing publicUrl, path (for deletion), and error.
 */
export async function uploadCollectionImage(file: File): Promise<{ publicUrl: string | null, path: string | null, error: string | null }> {
    const supabase = createServerActionClient();
    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `sets/${uniqueFileName}`;

    try {
        if (!BUCKET_NAME) {
            return { publicUrl: null, path: null, error: 'SUPABASE_BUCKET environment variable not set' };
        }

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            console.error('[Storage Helper Error] Upload Set Image:', uploadError.message);
            return { publicUrl: null, path: null, error: `Storage upload failed: ${uploadError.message}` };
        }

        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(uploadData.path);
        
        return { publicUrl: urlData.publicUrl, path: uploadData.path, error: null };

    } catch (error) {
        const typedError = error instanceof Error ? error : new Error('Unknown storage error');
        console.error('[Storage Helper Error] Unexpected Upload Set Image:', typedError.message);
        return { publicUrl: null, path: null, error: `Unexpected storage error: ${typedError.message}` };
    }
}

/**
 * Deletes a set image from Supabase Storage using its storage path.
 * @param imagePath The storage path of the image (e.g., 'sets/image.jpg').
 * @returns Object containing success status and error message.
 */
export async function deleteCollectionImage(imagePath: string): Promise<{ success: boolean, error: string | null }> {
    const supabase = createServerActionClient();
    
    if (!imagePath) {
         console.warn('[Storage Helper Warn] deleteCollectionImage called with empty path.');
        return { success: false, error: 'Image path cannot be empty.' };
    }

    try {
        const { error: deleteError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([imagePath]);

        if (deleteError) {
            console.error(`[Storage Helper Error] Delete Set Image (${imagePath}):`, deleteError.message);
            return { success: false, error: `Failed to delete image from storage: ${deleteError.message}` };
        }
        
        return { success: true, error: null };

    } catch (error) {
         const typedError = error instanceof Error ? error : new Error('Unknown error during image deletion');
        console.error(`[Storage Helper Error] Unexpected Delete Set Image (${imagePath}):`, typedError.message);
        return { success: false, error: `Failed to delete set image due to storage error: ${typedError.message}` };
    }
}


/**
 * Uploads an about image file to Supabase Storage.
 * @param file The image file to upload.
 * @returns Object containing publicUrl, path (for deletion), and error.
 */
export async function uploadAboutImage(file: File): Promise<{ publicUrl: string | null, path: string | null, error: string | null }> {
    const supabase = createServerActionClient();
    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `about/${uniqueFileName}`;

    try {
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            console.error('[Storage Helper Error] Upload About Image:', uploadError.message);
            return { publicUrl: null, path: null, error: `Storage upload failed: ${uploadError.message}` };
        }

        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(uploadData.path);
        
        return { publicUrl: urlData.publicUrl, path: uploadData.path, error: null };

    } catch (error) {
        const typedError = error instanceof Error ? error : new Error('Unknown storage error');
        console.error('[Storage Helper Error] Unexpected Upload About Image:', typedError.message);
        return { publicUrl: null, path: null, error: `Unexpected storage error: ${typedError.message}` };
    }
}

/**
 * Deletes a file from Supabase Storage using its storage path.
 * @param filePath The storage path of the file (e.g., 'about/image.jpg').
 * @returns Object containing success status and error message.
 */
export async function deleteFileByPath(filePath: string): Promise<{ success: boolean, error: string | null }> {
    const supabase = createServerActionClient();
    
    if (!filePath) {
        console.warn('[Storage Helper Warn] deleteFileByPath called with empty path.');
        return { success: false, error: 'File path cannot be empty.' };
    }

    try {
        const { error: deleteError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([filePath]);

        if (deleteError) {
            console.error(`[Storage Helper Error] Delete File (${filePath}):`, deleteError.message);
            return { success: false, error: `Failed to delete file from storage: ${deleteError.message}` };
        }
        
        return { success: true, error: null };

    } catch (error) {
        const typedError = error instanceof Error ? error : new Error('Unknown error during file deletion');
        console.error(`[Storage Helper Error] Unexpected Delete File (${filePath}):`, typedError.message);
        return { success: false, error: `Failed to delete file due to storage error: ${typedError.message}` };
    }
}

/**
 * Extracts the storage path from a public URL.
 * @param publicUrl The full public URL of the file.
 * @param bucketName The bucket name.
 * @returns The storage path or null if extraction fails.
 */
export function getStoragePathFromUrl(publicUrl: string, bucketName: string): string | null {
    try {
        const url = new URL(publicUrl);
        const pathParts = url.pathname.split('/');
        const publicIndex = pathParts.indexOf('public');
        const bucketNameIndex = pathParts.indexOf(bucketName);

        if (publicIndex === -1 || bucketNameIndex === -1 || bucketNameIndex !== publicIndex + 1 || bucketNameIndex + 1 >= pathParts.length) {
            console.error(`[Storage Helper Error] Could not extract path from URL: ${publicUrl}`);
            return null;
        }

        return pathParts.slice(bucketNameIndex + 1).join('/');
    } catch (error) {
        console.error(`[Storage Helper Error] Invalid URL: ${publicUrl}`, error);
        return null;
    }
} 