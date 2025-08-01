import { createServerActionClient } from "@/lib/supabase/server";
import { uploadProductImage, deleteProductImage } from '@/lib/helpers/storageHelpers';

export interface ImageUploadResult {
  publicUrl: string;
  path: string;
  tempId: string | null;
}

export interface ProductImageData {
  product_id: string;
  image_url: string;
  position: number;
  alt_text: string;
}

export async function processProductImages(
  imageFiles: Array<{ file: File; tempId: string | null }>
): Promise<{ uploadedImageResults: ImageUploadResult[]; uploadedImagePaths: string[] }> {
  const uploadedImageResults: ImageUploadResult[] = [];
  const uploadedImagePaths: string[] = [];

  const imageUploadPromises = imageFiles.map(async (fileInfo) => {
    const uploadResult = await uploadProductImage(fileInfo.file);
    if (uploadResult.error || !uploadResult.publicUrl || !uploadResult.path) {
      throw new Error(uploadResult.error || `Image upload failed: ${fileInfo.file.name}`);
    }
    uploadedImageResults.push({ 
      publicUrl: uploadResult.publicUrl, 
      path: uploadResult.path, 
      tempId: fileInfo.tempId 
    });
    uploadedImagePaths.push(uploadResult.path);
  });

  await Promise.all(imageUploadPromises);

  return { uploadedImageResults, uploadedImagePaths };
}

export function createImageInsertData(
  uploadedImageResults: ImageUploadResult[],
  finalImageOrderIds: string[],
  productId: string
): ProductImageData[] {
  const useOrder = finalImageOrderIds.length === uploadedImageResults.length && finalImageOrderIds.length > 0;

  return uploadedImageResults.map((uploadInfo, index) => {
    let position = index;
    if (useOrder && uploadInfo.tempId) {
      const orderIndex = finalImageOrderIds.indexOf(uploadInfo.tempId);
      if (orderIndex !== -1) position = orderIndex;
    }
    return {
      product_id: productId,
      image_url: uploadInfo.publicUrl,
      position: position,
      alt_text: `Product image ${position + 1}`
    };
  }).sort((a, b) => a.position - b.position);
}

export async function insertProductImages(
  imageInsertData: ProductImageData[]
): Promise<void> {
  if (imageInsertData.length === 0) return;

  const supabase = createServerActionClient();
  const { error: imageInsertError } = await supabase
    .from('product_images')
    .insert(imageInsertData);
    
  if (imageInsertError) {
    throw new Error(`Failed to insert image records: ${imageInsertError.message}`);
  }
}

export async function insertProductVariants(
  productId: string,
  sizeNames: string[]
): Promise<void> {
  if (!sizeNames || sizeNames.length === 0) return;

  const supabase = createServerActionClient();
  const productVariantsToInsert = sizeNames.map(sizeName => ({
    product_id: productId,
    size_name: sizeName,
  }));

  const { error: variantsInsertError } = await supabase
    .from('product_variants')
    .insert(productVariantsToInsert);
    
  if (variantsInsertError) {
    throw new Error(`Failed to insert product variants: ${variantsInsertError.message}`);
  }
}

export async function insertProductSetAssociations(
  productId: string,
  setIds: string[]
): Promise<void> {
  if (!setIds || setIds.length === 0) return;

  const supabase = createServerActionClient();
  const setInserts = setIds.map((setId: string, index: number) => ({ 
    product_id: productId, 
    set_id: setId,
    position: index
  }));

  const { error: insertSetsError } = await supabase
    .from('set_products')
    .insert(setInserts);
    
  if (insertSetsError) {
    throw new Error(`Failed to insert set associations: ${insertSetsError.message}`);
  }
}

export async function cleanupFailedProductCreation(
  uploadedImagePaths: string[],
  createdProductId: string | null,
  bucketName: string
): Promise<void> {
  const supabase = createServerActionClient();

  if (uploadedImagePaths.length > 0) {
    console.warn(`[Server Action Cleanup] Attempting cleanup for product creation failure in bucket ${bucketName}...`);
    try {
      const { error: cleanupDeleteError } = await supabase.storage
        .from(bucketName)
        .remove(uploadedImagePaths);
      if (cleanupDeleteError) {
        console.error('[Server Action Cleanup] Error deleting storage images:', cleanupDeleteError.message);
      }
    } catch (cleanupErr) {
      console.error('[Server Action Cleanup] Exception deleting storage images:', cleanupErr);
    }
  }

  if (createdProductId) {
    try {
      await supabase.from('products').delete().eq('id', createdProductId);
    } catch (cleanupErr) {
      console.error('[Server Action Cleanup] Exception deleting product record:', cleanupErr);
    }
  }
}

export function parseFormDataArrays(formData: FormData): {
  parsedSelectedSizeNames: string[];
  parsedSetIds: string[];
  error?: string;
} {
  const selectedSizeNamesString = formData.get('selected_size_names');
  const setIdsString = formData.get('setIds');

  let parsedSelectedSizeNames: string[] = [];
  if (typeof selectedSizeNamesString === 'string') {
    try {
      parsedSelectedSizeNames = JSON.parse(selectedSizeNamesString);
      if (!Array.isArray(parsedSelectedSizeNames)) parsedSelectedSizeNames = [];
    } catch (parseError: any) {
      return { 
        parsedSelectedSizeNames: [], 
        parsedSetIds: [], 
        error: `Invalid format for selected sizes: ${parseError.message}` 
      };
    }
  }

  let parsedSetIds: string[] = [];
  if (typeof setIdsString === 'string') {
    try {
      parsedSetIds = JSON.parse(setIdsString);
      if (!Array.isArray(parsedSetIds)) throw new Error('Parsed setIds is not an array.');
    } catch (e: any) {
      return { 
        parsedSelectedSizeNames, 
        parsedSetIds: [], 
        error: `Invalid format for set IDs: ${e.message}` 
      };
    }
  }

  return { parsedSelectedSizeNames, parsedSetIds };
}

export function prepareImageFiles(formData: FormData): Array<{ file: File; tempId: string | null }> {
  const { extractImageFilesFromFormData } = require('@/lib/helpers/formHelpers');
  const imageFiles = extractImageFilesFromFormData(formData);
  
  return imageFiles.map((file: File) => {
    const nameParts = file.name.split('___');
    let tempId: string | null = nameParts.length > 1 && nameParts[0].startsWith('temp-') ? nameParts[0] : null;
    return { file, tempId };
  });
}

export function parseImageOrder(imageOrderJson: string | null): string[] {
  if (typeof imageOrderJson !== 'string') return [];
  
  try {
    const finalImageOrderIds = JSON.parse(imageOrderJson);
    return Array.isArray(finalImageOrderIds) ? finalImageOrderIds : [];
  } catch {
    return [];
  }
}

export async function updateProductVariants(
  productId: string,
  newSizeNames: string[]
): Promise<void> {
  const supabase = createServerActionClient();

  const { data: existingVariants, error: fetchError } = await supabase
    .from('product_variants')
    .select('id, size_name')
    .eq('product_id', productId);

  if (fetchError) {
    throw new Error(`Failed to fetch existing variants: ${fetchError.message}`);
  }

  const existingVariantNames = new Set(existingVariants?.map(v => v.size_name) || []);
  const newVariantNames = new Set(newSizeNames);

  const variantsToDelete = existingVariants?.filter(v => !newVariantNames.has(v.size_name)) || [];
  
  const variantsToCreate = newSizeNames.filter(name => !existingVariantNames.has(name));

  if (variantsToDelete.length > 0) {
    const variantIdsToDelete = variantsToDelete.map(v => v.id);
    const { error: deleteError } = await supabase
      .from('product_variants')
      .delete()
      .in('id', variantIdsToDelete);

    if (deleteError) {
      throw new Error(`Failed to delete variants: ${deleteError.message}`);
    }
  }

  if (variantsToCreate.length > 0) {
    await insertProductVariants(productId, variantsToCreate);
  }
}

export async function updateProductImages(
  productId: string,
  formData: FormData,
  imageOrderJson: string | null
): Promise<string[]> {
  const supabase = createServerActionClient();
  const uploadedImagePaths: string[] = [];

  const finalImageOrderIds = parseImageOrder(imageOrderJson);
  const imageFiles = prepareImageFiles(formData);
  const deleteImageIds = formData.getAll('deleteImageIds') as string[];

  try {
    const { data: existingImages, error: fetchError } = await supabase
      .from('product_images')
      .select('id, image_url')
      .eq('product_id', productId);

    if (fetchError) {
      throw new Error(`Failed to fetch existing images: ${fetchError.message}`);
    }

    if (deleteImageIds.length > 0) {
      const imagesToDelete = existingImages?.filter(img => deleteImageIds.includes(img.id)) || [];
      
      for (const img of imagesToDelete) {
        const deleteResult = await deleteProductImage(img.image_url);
        if (!deleteResult.success) {
          console.warn(`Failed to delete image from storage: ${img.image_url}`, deleteResult.error);
        }
      }

      const { error: dbDeleteError } = await supabase
        .from('product_images')
        .delete()
        .in('id', deleteImageIds);

      if (dbDeleteError) {
        console.error('Failed to delete image records from DB:', dbDeleteError);
  }
    }

    if (imageFiles.length > 0) {
  const { uploadedImageResults, uploadedImagePaths: newPaths } = await processProductImages(imageFiles);
  uploadedImagePaths.push(...newPaths);

  const imageInsertData = createImageInsertData(uploadedImageResults, finalImageOrderIds, productId);
  await insertProductImages(imageInsertData);
    }

    if (finalImageOrderIds.length > 0) {
      const { data: currentImages, error: fetchCurrentError } = await supabase
        .from('product_images')
        .select('id, position')
        .eq('product_id', productId);

      if (fetchCurrentError) {
        throw new Error(`Failed to fetch current images for position update: ${fetchCurrentError.message}`);
      }

      const existingImageMap = new Map((currentImages || []).map(img => [img.id, img]));
      const updateData: { id: string; position: number }[] = [];

      finalImageOrderIds.forEach((id, index) => {
        if (!id.startsWith('temp-')) {
          const existing = existingImageMap.get(id);
          if (existing && existing.position !== index) {
            updateData.push({ id: id, position: index });
          }
        }
      });

      if (updateData.length > 0) {
        for (const update of updateData) {
          const { error: updateError } = await supabase
            .from('product_images')
            .update({ position: update.position })
            .eq('id', update.id);

          if (updateError) {
            console.error(`Failed to update image position for ${update.id}:`, updateError);
          }
        }
      }
    }

  return uploadedImagePaths;

  } catch (error) {
    if (uploadedImagePaths.length > 0) {
      const bucketName = process.env.SUPABASE_BUCKET || 'infideli-images';
      await Promise.allSettled(
        uploadedImagePaths.map(path => 
          supabase.storage.from(bucketName).remove([path])
        )
      );
    }
    throw error;
  }
}

export async function updateProductSetAssociations(
  productId: string,
  newSetIds: string[]
): Promise<void> {
  const supabase = createServerActionClient();

  const { error: deleteError } = await supabase
    .from('set_products')
    .delete()
    .eq('product_id', productId);

  if (deleteError) {
    throw new Error(`Failed to delete existing set associations: ${deleteError.message}`);
  }

  if (newSetIds.length > 0) {
    await insertProductSetAssociations(productId, newSetIds);
  }
} 