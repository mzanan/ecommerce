'use server';

import { createServerComponentClient, createServerActionClient } from "@/lib/supabase/server";
import type { 
    SetRow, 
    ProductWithPosition 
} from '@/types/db';
import type { ActionResponse } from '@/types/actions';
import type {
    PublicSetListItem, 
    AdminSetListItem, 
    ProductWithThumbnail,
    SetPageProduct,
    SetPageData, 
    SetPageResult, 
    AdminSetsListResult, 
    AvailableProductsResult 
} from '@/types/sets';
import type { SelectOption } from '@/types/ui';
import type { SetType, SetLayoutType } from '@/lib/schemas/setSchema';
import type { 
    PublicSetsListResult,
    AdminSetsListParams,
    AvailableProductsParams 
} from '@/types/setActions';

export async function getPublicSetsList(limit?: number): Promise<PublicSetsListResult> {
    const supabase = createServerComponentClient(); 

    try {
        let query = supabase
            .from('sets')
            .select(`
                id, name, slug, type, description, layout_type,
                set_images!left(image_url, position),
                set_products!inner(product_id)
            `)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .order('position', { referencedTable: 'set_images', ascending: true, nullsFirst: false });

        if (limit && limit > 0) {
            query = query.limit(limit);
        }

        const { data: setsData, error } = await query;

        if (error) {
            console.error("Error fetching public sets:", error);
            return { success: false, error: `Database error: ${error.message}` };
        }
        
        const setsWithProductsData = (setsData || []).filter(s => s.set_products && s.set_products.length > 0);

        const sets: PublicSetListItem[] = setsWithProductsData.map((s: any) => ({ 
            id: s.id,
            name: s.name,
            slug: s.slug,
            type: s.type as SetType | null,
            description: s.description,
            layout_type: s.layout_type as SetLayoutType | null,
            image_urls: (s.set_images || []).map((img: any) => img.image_url).filter(Boolean)
        }));

        return { success: true, data: { sets } };

    } catch (err: any) {
        return { success: false, error: `Server error: ${err.message || 'Unknown error'}` };
    }
}

export const getAdminSetsList = async (params: AdminSetsListParams = {}): Promise<AdminSetsListResult> => {
    const supabase = createServerActionClient();
    const { orderBy = 'created_at', orderAsc = false, filters = {} } = params;

    try {
        let countQuery = supabase
            .from('sets')
            .select('*', { count: 'exact', head: true });

        if (filters.name) countQuery = countQuery.ilike('name', `%${filters.name}%`);
        if (filters.type) countQuery = countQuery.eq('type', filters.type);
        if (filters.is_active !== undefined && filters.is_active !== null) countQuery = countQuery.eq('is_active', filters.is_active);
        
        const { count, error: countError } = await countQuery;
        if (countError) {
            console.error('Error fetching sets count:', countError);
            return { success: false, error: `Count query failed: ${countError.message}` };
        }

        let dataQuery = supabase
            .from('sets')
            .select(`
                *,
                set_images!left(image_url)
            `)
            .order(orderBy, { ascending: orderAsc })
            .order('position', { referencedTable: 'set_images', ascending: true, nullsFirst: false })
            .limit(1, { referencedTable: 'set_images' });

        if (filters.name) dataQuery = dataQuery.ilike('name', `%${filters.name}%`);
        if (filters.type) dataQuery = dataQuery.eq('type', filters.type);
        if (filters.is_active !== undefined && filters.is_active !== null) dataQuery = dataQuery.eq('is_active', filters.is_active);

        if (params.limit && params.offset !== undefined) {
             dataQuery = dataQuery.range(params.offset, params.offset + params.limit - 1);
        }

        const { data: setsData, error: dataError } = await dataQuery;

        if (dataError) {
            return { success: false, error: `Database error: ${dataError.message}` };
        }

        let productCounts: { [key: string]: number } = {};
        if (setsData && setsData.length > 0) {
            const setIds = setsData.map(s => s.id);
            const { data: simpleCountsData, error: simpleCountsError } = await supabase
                 .from('set_products')
                 .select('set_id, product_id')
                 .in('set_id', setIds);

             if (simpleCountsError) {
                console.error('Error fetching product counts for sets:', simpleCountsError);
                productCounts = {};
             } else {
                 productCounts = (simpleCountsData || []).reduce((acc, item) => {
                     acc[item.set_id] = (acc[item.set_id] || 0) + 1;
                     return acc;
                 }, {} as { [key: string]: number });
             }
        }

        const sets: AdminSetListItem[] = (setsData || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            is_active: c.is_active,
            product_count: productCounts[c.id] || 0, 
            type: c.type as SetType | null, 
            created_at: c.created_at,
            image_url: c.set_images && c.set_images.length > 0 ? c.set_images[0].image_url : null
        }));

        return { success: true, data: { sets, count: count ?? 0 } };

    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return { success: false, error: message };
    }
};

export async function getAdminSetById(id: string): Promise<ActionResponse<SetRow & { set_images: any[] }>> {
    const supabase = createServerActionClient();
    if (!id) return { success: false, error: 'Set ID is required' };

    try {
        const { data, error } = await supabase
            .from('sets')
            .select(`
                *,
                set_images:set_images(*)
            `)
            .eq('id', id)
            .single();


        if (error) {
            if (error.code === 'PGRST116') return { success: false, error: 'Set not found' };
            return { success: false, error: `DB error: ${error.message}` };
        }

        const setData = data as SetRow & { set_images: any[] };
        setData.set_images = (setData.set_images || []).sort((a: any, b: any) => (a.position ?? Infinity) - (b.position ?? Infinity));

        return { success: true, data: setData };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message };
    }
}

export const getSetPageBySlug = async (slug: string): Promise<SetPageResult> => {
    const supabase = createServerActionClient();
    if (!slug) return { success: false, error: 'Slug is required' };

    try {
        const { data: setData, error: setError } = await supabase
            .from('sets')
            .select(`
                *,
                set_images!left(id, image_url, alt_text, position),
                products:set_products(position, product:products!inner(*, product_images(*), product_variants(id, product_id, size_name), product_categories!left(id, name, size_guide_id, size_guide_templates!left(id, name, guide_data))))
            `)
            .eq('slug', slug)
            .eq('is_active', true)
            .order('position', { referencedTable: 'set_images', ascending: true, nullsFirst: false })
            .order('position', { referencedTable: 'set_products', ascending: true, nullsFirst: false })
            .maybeSingle();

        if (setError) {
            return { success: false, error: `Database error: ${setError.message}` };
        }

        if (!setData) {
            return { success: false, error: 'Set not found' };
        }

        const sortedImages = (setData.set_images || []).sort((a: any, b: any) => (a.position ?? Infinity) - (b.position ?? Infinity));
        const sortedProducts = (setData.products || []).sort((a: any, b: any) => (a.position ?? Infinity) - (b.position ?? Infinity));

        const processedProducts: SetPageProduct[] = sortedProducts.map((sp: any) => {
            const product = sp.product;
            const primaryImage = product.product_images?.find((img: any) => img.is_primary) 
                || product.product_images?.[0] 
                || null;

            const sizes = (product.product_variants || [])
                .map((v: any) => v.size_name)
                .filter((s: any) => s)
                .sort();

            const uniqueSizes = Array.from(new Set(sizes));

            return {
                ...product,
                position: sp.position,
                primary_image: primaryImage,
                sizes: uniqueSizes,
                category: product.product_categories?.[0] || null,
            };
        });

        const result: SetPageData = {
            ...setData,
            type: setData.type as SetType | null,
            layout_type: setData.layout_type as SetLayoutType | null,
            set_images: sortedImages,
            products: processedProducts
        };

        return { success: true, data: result };

    } catch (err: any) {
        return { success: false, error: `Server error: ${err.message || 'Unknown error'}` };
    }
};

export async function getSetsForSelection(): Promise<ActionResponse<{ sets: SelectOption[] }>> {
    const supabase = createServerComponentClient();

    try {
        const { data, error } = await supabase
            .from('sets')
            .select('id, name')
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching sets for selection:', error);
            return { success: false, error: `Database error: ${error.message}` };
        }

        const sets: SelectOption[] = (data || []).map(s => ({ value: s.id, label: s.name }));
        return { success: true, data: { sets } };

    } catch (err: any) {
        return { success: false, error: `Server error: ${err.message || 'Unknown error'}` };
    }
}

export async function getAvailableProductsForSetAction(
    setId: string,
    params: AvailableProductsParams = {}
): Promise<AvailableProductsResult> {
    const supabase = createServerActionClient();
    const { limit = 8, offset = 0, search = '' } = params;

    try {
        const { data: existingProductIds, error: existingError } = await supabase
            .from('set_products')
            .select('product_id')
            .eq('set_id', setId);

        if (existingError) {
            return { success: false, error: existingError.message };
        }
        
        const existingIds = existingProductIds?.map(item => item.product_id) || [];

        let query = supabase
            .from('products')
            .select(`
                id, 
                name, 
                slug,
                product_images!left(image_url)
            `, { count: 'exact' })
            .eq('is_active', true);

        if (existingIds.length > 0) {
            query = query.not('id', 'in', `(${existingIds.join(',')})`);
        }

        if (search.trim()) {
            query = query.ilike('name', `%${search.trim()}%`);
        }

        query = query
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });

        const { data, error, count } = await query;

        if (error) {
            return { success: false, error: error.message };
        }

        const products: ProductWithThumbnail[] = (data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            thumbnail_url: p.product_images?.[0]?.image_url || null
        }));

        return {
            success: true,
            data: {
                products,
                count: count || 0
            }
        };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return { success: false, error: errorMessage };
    }
}

export async function getProductsInSetAction(setId: string): Promise<ActionResponse<{ products: ProductWithPosition[] }>> {
    const supabase = createServerActionClient();
    
    try {
        const { data, error } = await supabase
            .from('set_products')
            .select(`
                position,
                product:products!inner(
                    *,
                    product_images!left(image_url, position)
                )
            `)
            .eq('set_id', setId)
            .order('position', { ascending: true, nullsFirst: false });

        if (error) {
            return { success: false, error: `Database error: ${error.message}` };
        }

        const products: ProductWithPosition[] = (data || []).map((item: any) => {
            const sortedImages = (item.product.product_images || []).sort(
                (a: any, b: any) => (a.position ?? Infinity) - (b.position ?? Infinity)
            );
            
            return {
                ...item.product,
                product_images: sortedImages,
                position: item.position
            };
        });

        return { success: true, data: { products } };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return { success: false, error: message };
    }
}

export async function getSetsByIdsAction(setIds: string[]): Promise<ActionResponse<SetRow[]>> {
    if (!setIds || setIds.length === 0) {
        return { success: true, data: [] };
    }
    const supabase = createServerActionClient();
    try {
        const { data, error } = await supabase
            .from('sets')
            .select('*')
            .in('id', setIds);
        
        if (error) {
            return { success: false, error: `Database error: ${error.message}` };
        }

        return { success: true, data };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return { success: false, error: message };
    }
} 