"use server";

import { createServerActionClient } from "@/lib/supabase/server";
import { createProductSchema } from '@/lib/schemas/productSchema';
import { revalidatePath, revalidateTag } from 'next/cache';
import type { ActionResponse } from '@/types/actions';
import {
  parseFormDataArrays,
  prepareImageFiles,
  parseImageOrder,
  processProductImages,
  createImageInsertData,
  insertProductImages,
  insertProductVariants,
  insertProductSetAssociations,
  cleanupFailedProductCreation
} from '@/lib/helpers/productHelpers';

export async function createProduct(
  prevState: ActionResponse | null,
  formData: FormData
): Promise<ActionResponse> {
  const supabase = createServerActionClient();
  const bucketName = process.env.SUPABASE_BUCKET;

  if (!bucketName) {
    const errMsg = "Error: SUPABASE_BUCKET environment variable is not set.";
    console.error(errMsg);
    return { success: false, error: `Server configuration error: ${errMsg}` };
  }

  const { parsedSelectedSizeNames, parsedSetIds, error: parseError } = parseFormDataArrays(formData);
  if (parseError) {
    return { success: false, error: parseError };
  }

  const imageFiles = prepareImageFiles(formData);
  const finalImageOrderIds = parseImageOrder(formData.get('imageOrder') as string | null);
  const categoryId = formData.get('category_id') as string | null;
  const stockQuantity = formData.get('stock_quantity');

  const rawData = {
    name: formData.get('name') as string | null,
    slug: formData.get('slug') as string | null,
    description: formData.get('description') || null,
    price: formData.get('price'), 
    is_active: formData.get('is_active') === 'true',
    images: imageFiles.map(f => f.file),
    setIds: parsedSetIds,
    category_id: categoryId,
    stock_quantity: stockQuantity,
    selected_size_names: parsedSelectedSizeNames,
  };

  const validationResult = createProductSchema.safeParse(rawData);

  if (!validationResult.success) {
    const errorDetail = JSON.stringify(validationResult.error.flatten().fieldErrors);
    console.error('[Server Action Error] Create Product Validation:', errorDetail);
    return { success: false, error: `Validation failed: ${errorDetail}` };
  }
  
  const { 
    images: _images, 
    setIds: validatedSetIds, 
    category_id: validatedCategoryId, 
    stock_quantity: validatedStockQuantity, 
    selected_size_names: validatedSelectedSizeNames, 
    ...validatedProductData 
  } = validationResult.data;
  
  const uploadedImagePaths: string[] = []; 
  let createdProductId: string | null = null;

  try {
    const { data: productData, error: productInsertError } = await supabase
      .from('products')
      .insert({ 
        ...validatedProductData, 
        category_id: validatedCategoryId,
        stock_quantity: validatedStockQuantity,
      })
      .select('id')
      .single();

    if (productInsertError) {
      console.error('[Server Action Error] Create Product DB Insert:', productInsertError.message);
      if (productInsertError.code === '23505') { 
        return { success: false, error: `Database error: Slug '${validatedProductData.slug}' already exists.` };
      }
      return { success: false, error: `Database error: ${productInsertError.message}` };
    }
    
    createdProductId = productData.id;

    await insertProductVariants(createdProductId, validatedSelectedSizeNames || []);

    if (imageFiles.length > 0) {
      const { uploadedImageResults, uploadedImagePaths: paths } = await processProductImages(
        imageFiles
      );
      uploadedImagePaths.push(...paths);

      const imageInsertData = createImageInsertData(uploadedImageResults, finalImageOrderIds, createdProductId);
      await insertProductImages(imageInsertData);
    }

    await insertProductSetAssociations(createdProductId, validatedSetIds || []);

    revalidateTag('products');
    revalidateTag(`product-${validatedProductData.slug}`);
    revalidatePath('/admin/products');
    revalidatePath(`/product/${validatedProductData.slug}`);
    revalidatePath('/');
    
    return { success: true, message: 'Product created successfully' };

  } catch (error) {
    console.error('[Server Action Error] Create Product Flow Error:', error);

    await cleanupFailedProductCreation(uploadedImagePaths, createdProductId, bucketName);

    const typedError = error instanceof Error ? error : new Error('Unknown error during product creation');
    return { success: false, error: `Error creating product: ${typedError.message}` };
  }
} 