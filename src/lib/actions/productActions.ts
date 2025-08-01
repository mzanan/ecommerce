"use server";

import { createServerActionClient, createServerComponentClient } from "@/lib/supabase/server";
import { createProductSchema, updateProductSchema } from '@/lib/schemas/productSchema';
import { revalidatePath, revalidateTag } from 'next/cache';
import { uploadProductImage } from '@/lib/helpers/storageHelpers';
import type { ProductImageRow } from '@/types/db';
import type { ActionResponse } from '@/types/actions';
import type { 
    ProductWithIncludes, 
    ProductListResponse, 
    ProductPageData, 
    ProductForEdit, 
    ProductByIdEditResponse,
    ProductWithJoinData
} from '@/types/product';
import {
  parseFormDataArrays,
  prepareImageFiles,
  cleanupFailedProductCreation,
  updateProductVariants,
  updateProductImages,
  updateProductSetAssociations
} from '@/lib/helpers/productHelpers';

export type { ProductPageData };
export type { ProductByIdEditResponse };

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

    const { extractImageFilesFromFormData } = require('@/lib/helpers/formHelpers');
  const imageFiles = extractImageFilesFromFormData(formData);
    const imageOrderJson = formData.get('imageOrder');
    const setIdsString = formData.get('setIds');
    const categoryId = formData.get('category_id') as string | null;
    const stockQuantity = formData.get('stock_quantity');
    const selectedSizeNamesString = formData.get('selected_size_names');

    let parsedSelectedSizeNames: string[] = [];
    if (typeof selectedSizeNamesString === 'string') {
        try {
            parsedSelectedSizeNames = JSON.parse(selectedSizeNamesString);
            if (!Array.isArray(parsedSelectedSizeNames)) parsedSelectedSizeNames = [];
        } catch (parseError: any) {
            console.error("[Server Action Error] Create: Failed to parse selected_size_names JSON:", parseError.message);
            return { success: false, error: `Invalid format for selected sizes: ${parseError.message}` }; 
        }
    }

    let parsedSetIds: string[] = [];
    if (typeof setIdsString === 'string') {
        try {
            parsedSetIds = JSON.parse(setIdsString);
            if (!Array.isArray(parsedSetIds)) throw new Error('Parsed setIds is not an array.');
        } catch (e: any) {
            console.error(`[Server Action Error] Create: Failed to parse set IDs JSON:`, e.message);
            return { success: false, error: `Invalid format for set IDs: ${e.message}` };
        }
    }

    const rawData = {
        name: formData.get('name') as string | null,
        slug: formData.get('slug') as string | null,
        description: formData.get('description') || null,
        price: formData.get('price'), 
        is_active: formData.get('is_active') === 'true',
        images: imageFiles,
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
    
    const { images: imageFilesToUploadRaw, setIds: validatedSetIds, category_id: validatedCategoryId, stock_quantity: validatedStockQuantity, selected_size_names: validatedSelectedSizeNames, ...validatedProductData } = validationResult.data;
    
    let finalImageOrderIds: string[] = [];
    if (typeof imageOrderJson === 'string') {
        try {
            finalImageOrderIds = JSON.parse(imageOrderJson);
            if (!Array.isArray(finalImageOrderIds)) finalImageOrderIds = [];
        } catch {
            finalImageOrderIds = []; 
        }
    }

    const imageFilesToUpload: Array<{ file: File; tempId: string | null }> = imageFilesToUploadRaw.map(file => {
        const nameParts = file.name.split('___');
        let tempId: string | null = nameParts.length > 1 && nameParts[0].startsWith('temp-') ? nameParts[0] : null;
        
        return { file, tempId };
    });
    
    const useOrder = finalImageOrderIds.length === imageFilesToUpload.length && finalImageOrderIds.length > 0;
    
    const uploadedImageResults: Array<{ publicUrl: string; path: string; tempId: string | null }> = []; 
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

        if (validatedSelectedSizeNames && validatedSelectedSizeNames.length > 0) {
            const productVariantsToInsert = validatedSelectedSizeNames.map(sizeName => ({
                product_id: createdProductId!,
                size_name: sizeName,
            }));

            if (productVariantsToInsert.length > 0) {
                const { error: variantsInsertError } = await supabase
                    .from('product_variants')
                    .insert(productVariantsToInsert);
                if (variantsInsertError) {
                    throw new Error(`Failed to insert product variants: ${variantsInsertError.message}`);
                }
            }
        }

        const imageUploadPromises = imageFilesToUpload.map(async (fileInfo) => {
            const uploadResult = await uploadProductImage(fileInfo.file);
            if (uploadResult.error || !uploadResult.publicUrl || !uploadResult.path) {
                throw new Error(uploadResult.error || `Image upload failed: ${fileInfo.file.name}`);
            }
            uploadedImageResults.push({ publicUrl: uploadResult.publicUrl, path: uploadResult.path, tempId: fileInfo.tempId });
            uploadedImagePaths.push(uploadResult.path);
        });
        await Promise.all(imageUploadPromises);

        const imageInsertData = uploadedImageResults.map((uploadInfo, index) => {
            let position = index;
            if (useOrder && uploadInfo.tempId) {
                const orderIndex = finalImageOrderIds.indexOf(uploadInfo.tempId);
                if (orderIndex !== -1) position = orderIndex;
            }
            return {
                product_id: createdProductId!,
                image_url: uploadInfo.publicUrl,
                position: position,
                alt_text: `Product image ${position + 1}`
            };
        }).sort((a, b) => a.position - b.position);

        if (imageInsertData.length > 0) {
             const { error: imageInsertError } = await supabase
                .from('product_images')
                .insert(imageInsertData);
            if (imageInsertError) throw new Error(`Failed to insert image records: ${imageInsertError.message}`);
        }

        if (validatedSetIds && Array.isArray(validatedSetIds) && validatedSetIds.length > 0) {
            const setInserts = validatedSetIds.map((setId: string, index: number) => ({ 
                product_id: createdProductId!, 
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

        revalidateTag('products');
        revalidateTag(`product-${validatedProductData.slug}`);
        revalidatePath('/admin/products');
        revalidatePath(`/product/${validatedProductData.slug}`);
        revalidatePath('/');
        
        return { success: true, message: 'Product created successfully' };

    } catch (error) {
        console.error('[Server Action Error] Create Product Flow Error:', error);

        if (uploadedImagePaths.length > 0) {
            console.warn(`[Server Action Cleanup] Attempting cleanup for product creation failure in bucket ${bucketName}...`);
             try {
                const { error: cleanupDeleteError } = await supabase.storage.from(bucketName).remove(uploadedImagePaths);
                if (cleanupDeleteError) console.error('[Server Action Cleanup] Error deleting storage images:', cleanupDeleteError.message);
             } catch (cleanupErr) { console.error('[Server Action Cleanup] Exception deleting storage images:', cleanupErr); }
        }
        if (createdProductId) {
             try {
                await supabase.from('products').delete().eq('id', createdProductId);
             } catch (cleanupErr) { console.error('[Server Action Cleanup] Exception deleting product record:', cleanupErr); }
        }

        const typedError = error instanceof Error ? error : new Error('Unknown error during product creation');
        
        return { success: false, error: `Error creating product: ${typedError.message}` };
    }
}

export async function updateProduct(
  productId: string,
  prevState: ActionResponse | null,
  formData: FormData
): Promise<ActionResponse> { 
    const supabase = createServerActionClient();
    const bucketName = process.env.SUPABASE_BUCKET;

    if (!bucketName) {
        const errMsg = "CRITICAL ERROR: SUPABASE_BUCKET environment variable not set. Required for product update.";
        console.error(errMsg);
        return { success: false, error: `Server configuration error: ${errMsg}` };
    }
    
    const { parsedSelectedSizeNames, parsedSetIds, error: parseError } = parseFormDataArrays(formData);
    if (parseError) {
        return { success: false, error: parseError };
    }

    const imageFiles = prepareImageFiles(formData);
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

    const validationResult = updateProductSchema.safeParse(rawData);

    if (!validationResult.success) {
        const errorDetail = JSON.stringify(validationResult.error.flatten().fieldErrors);
        console.error('[Server Action Error] Update Product Validation:', errorDetail);
        return { success: false, error: `Validation failed: ${errorDetail}` };
    }

    const { 
        setIds: _validatedSetIds, 
        category_id: validatedCategoryId,            
        stock_quantity: validatedStockQuantity,      
        selected_size_names: _validatedSelectedSizeNames,
        images: _images,
        ...validatedProductData 
    } = validationResult.data;

    const uploadedImagePaths: string[] = [];
    
    try {
        const { error: productUpdateError } = await supabase
            .from('products')
            .update({ 
                ...validatedProductData, 
                category_id: validatedCategoryId,        
                stock_quantity: validatedStockQuantity,  
                updated_at: new Date().toISOString(), 
            })
            .eq('id', productId);

        if (productUpdateError) {
            console.error('[Server Action Error] Update Product DB:', productUpdateError.message);
             if (productUpdateError.code === '23505') {
                 return { success: false, error: `Database error: Slug '${validatedProductData.slug}' already exists for another product.` };
            }
            return { success: false, error: `Database error updating product: ${productUpdateError.message}` };
        }

        try {
            if (_validatedSelectedSizeNames && _validatedSelectedSizeNames.length > 0) {
                await updateProductVariants(productId, _validatedSelectedSizeNames);
            }

            const imageOrderJson = formData.get('imageOrder') as string | null;
            const newImagePaths = await updateProductImages(productId, formData, imageOrderJson);
            uploadedImagePaths.push(...newImagePaths);

            if (_validatedSetIds && _validatedSetIds.length > 0) {
                await updateProductSetAssociations(productId, _validatedSetIds);
            }
        } catch (helperError: any) {
            throw new Error(`Helper operation failed: ${helperError.message}`);
        }

        revalidateTag('products');
        revalidateTag(`product-${validatedProductData.slug}`);
        revalidatePath('/admin/products');
        revalidatePath(`/product/${validatedProductData.slug}`);
        revalidatePath('/');
        
        return { success: true, message: 'Product updated successfully' };

    } catch (error) {
        console.error('[Server Action Error] Update Product Flow Error:', error);

        await cleanupFailedProductCreation(uploadedImagePaths, null, bucketName);

        const typedError = error instanceof Error ? error : new Error('Unknown error during product update');
        return { success: false, error: `Error updating product: ${typedError.message}` };
    }
}

export async function deleteProduct(productId: string): Promise<ActionResponse> {
    const supabase = createServerActionClient();

    if (!productId) {
        return { success: false, error: 'Product ID is required' };
    }

    try {
        const { data: productData, error: fetchError } = await supabase
            .from('products')
            .select('slug')
            .eq('id', productId)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return { success: false, error: 'Product not found' };
            }
            return { success: false, error: `Error fetching product: ${fetchError.message}` };
        }

        const { error: deleteError } = await supabase
            .from('products')
            .delete()
            .eq('id', productId);

        if (deleteError) {
            console.error('[Server Action Error] Delete Product:', deleteError.message);
            return { success: false, error: `Error deleting product: ${deleteError.message}` };
        }

        revalidateTag('products');
        if (productData.slug) {
            revalidateTag(`product-${productData.slug}`);
            revalidatePath(`/product/${productData.slug}`);
        }
        revalidatePath('/admin/products');
        revalidatePath('/');

        return { success: true, message: 'Product deleted successfully' };

    } catch (error) {
        console.error('[Server Action Error] Delete Product Flow Error:', error);
        const typedError = error instanceof Error ? error : new Error('Unknown error during product deletion');
        return { success: false, error: `Error deleting product: ${typedError.message}` };
    }
}

export const getProductsListAction = async (params: { 
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderAsc?: boolean;
    filters?: Record<string, any>; 
}): Promise<ProductListResponse> => {
    const { limit = 10, offset = 0, orderBy = 'created_at', orderAsc = false, filters = {} } = params;
    const supabase = createServerActionClient();
    
    try {
        let query = supabase
            .from('products')
            .select(`
                id, name, slug, description, price, is_active, category_id, stock_quantity, created_at, updated_at,
                product_images (id, image_url, position, alt_text),
                product_variants (id, size_name),
                set_products!left(
                    sets ( id, name )
                )
            `, { count: 'exact' }); 
            
        if (orderBy) {
             query = query.order(orderBy, { ascending: orderAsc });
        } else {
             query = query.order('created_at', { ascending: false }); 
        }
        
        query = query.range(offset, offset + limit - 1);

        for (const key in filters) {
            if (filters[key] !== undefined && filters[key] !== null) {
                if (key === 'name') {
                    query = query.ilike(key, `%${filters[key]}%`); 
                } else {
                    query = query.eq(key, filters[key]); 
                }
            }
        }
        
        const { data, error, count } = await query;

        if (error) {
            console.error('Supabase error fetching product list:', error.message);
            return { success: false, error: error.message }; 
        }

        const productsData = data || [];
        
        const products = productsData.map((p: any): ProductWithIncludes => {
            const firstSetLink = (p.set_products || []).find((cp: any) => cp.sets);
            return {
                ...p,
                set: firstSetLink?.sets ?? null,
                product_images: (p.product_images || []).sort((a: ProductImageRow, b: ProductImageRow) => (a.position ?? Infinity) - (b.position ?? Infinity)),
                product_variants: p.product_variants || [],
                set_products: undefined,
            } as ProductWithIncludes;
        });

        const totalPages = typeof count === 'number' ? Math.ceil(count / limit) : null;

        return { 
            success: true, 
            data: { products, totalPages, count: count ?? 0 }
        }; 

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        console.error('Caught error in getProductsListAction:', errorMessage);
        return { success: false, error: errorMessage }; 
    }
};

export async function getProductBySlugAction(params: { 
    slug: string 
}): Promise<ActionResponse<ProductPageData>> { 
    const supabase = createServerActionClient();

    try {
        const { data, error } = await supabase
            .from('products')
            .select(`
                id, name, slug, description, price, is_active, category_id, stock_quantity, created_at, updated_at,
                product_images (id, image_url, position, alt_text),
                product_variants (id, size_name),
                set_products (set_id)
            `)
            .eq('slug', params.slug)
            .eq('is_active', true)
            .single<ProductWithJoinData>();

        if (error) {
            if (error.code === 'PGRST116') { 
                return { success: false, error: 'Product not found' };
            }
            console.error('Supabase error fetching product page data:', error.message);
            return { success: false, error: error.message || 'Database error fetching product data' };
        }

        if (!data) {
            return { success: false, error: 'Product not found' };
        }
        
        const sortedImages = (data.product_images || []).sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
        const productVariantsData = data.product_variants || [];

        const productPageData: ProductPageData = {
            ...(data as Omit<ProductWithJoinData, 'product_images' | 'product_variants' | 'set_products'>),
            id: data.id,
            name: data.name,
            slug: data.slug,
            description: data.description,
            price: data.price,
            is_active: data.is_active,
            category_id: data.category_id, 
            stock_quantity: data.stock_quantity,
            created_at: data.created_at,
            updated_at: data.updated_at,
            product_images: sortedImages,
            product_variants: productVariantsData.map(pv => ({id: pv.id, size_name: pv.size_name })),
            set_products: data.set_products || []
        };

        return { success: true, data: productPageData }; 

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        console.error(`Caught error in getProductBySlugAction (${params.slug}):`, errorMessage);
        return { success: false, error: errorMessage };
    }
}

export const getProductByIdForEdit = async (
    productId: string
): Promise<ProductByIdEditResponse> => {
    const supabase = createServerComponentClient();

    try {
        const { data, error } = await supabase
            .from('products')
            .select(`
                *,
                product_images (*),
                product_variants (id, size_name),
                set_products (set_id),
                product_categories (
                    id,
                    name,
                    size_guide_id,
                    size_guide_templates (id, name)
                )
            `)
            .eq('id', productId)
            .single<ProductWithJoinData>();

        if (error) {
            console.error('[DB Error] getProductByIdForEdit:', error);
            return { success: false, error: `Database error: ${error.message}` };
        }
        if (!data) {
            return { success: false, error: 'Product not found.' };
        }

        const productForEdit: ProductForEdit = {
            id: data.id,
            name: data.name,
            slug: data.slug,
            description: data.description,
            price: data.price,
            is_active: data.is_active,
            is_featured: data.is_featured,
            created_at: data.created_at,
            updated_at: data.updated_at,
            images: data.product_images ? data.product_images.map(img => ({ ...img })) : [],
            currentSetIds: data.set_products ? data.set_products.map(sp => sp.set_id) : [],
            category_id: data.category_id,
            category: data.product_categories ? {
                id: data.product_categories.id,
                name: data.product_categories.name,
                size_guide_id: data.product_categories.size_guide_id,
                size_guide_template: data.product_categories.size_guide_templates 
                    ? { id: data.product_categories.size_guide_templates.id, name: data.product_categories.size_guide_templates.name } 
                    : null,
            } : null,
            stock_quantity: data.stock_quantity,
            selected_size_names: data.product_variants ? data.product_variants.map(pv => pv.size_name) : [],
        };
        
        return { success: true, data: productForEdit };

    } catch (e: any) {
        console.error('[Server Action Error] getProductByIdForEdit:', e);
        return { success: false, error: `Unexpected server error: ${e.message}` };
    }
};