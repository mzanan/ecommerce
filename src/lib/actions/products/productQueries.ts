"use server";

import { createServerComponentClient } from "@/lib/supabase/server";
import type { ActionResponse } from '@/types/actions';
import type { 
  ProductListResponse, 
  ProductPageData, 
  ProductByIdEditResponse
} from '@/types/product';
import type { Database } from '@/types/supabase';

type ProductWithJoinData = Database['public']['Tables']['products']['Row'] & {
  product_images: Database['public']['Tables']['product_images']['Row'][] | null;
  product_variants: Database['public']['Tables']['product_variants']['Row'][] | null;
  set_products: { 
    set_id: string; 
  }[] | null;
  product_categories: (Database['public']['Tables']['product_categories']['Row'] & {
    size_guide_templates: Database['public']['Tables']['size_guide_templates']['Row'] | null;
  }) | null;
};

export const getProductsListAction = async (params: { 
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderAsc?: boolean;
  filters?: Record<string, any>; 
}): Promise<ProductListResponse> => {
  const supabase = createServerComponentClient();
  const { limit = 10, offset = 0, orderBy = 'created_at', orderAsc = false, filters = {} } = params;

  try {
    let query = supabase
      .from('products')
      .select(`
        id, name, slug, price, is_active, created_at, stock_quantity,
        product_images!left(image_url, position),
        product_categories!left(name)
      `, { count: 'exact' })
      .order('position', { referencedTable: 'product_images', ascending: true, nullsFirst: false })
      .limit(1, { referencedTable: 'product_images' });

    if (filters.name) {
      query = query.ilike('name', `%${filters.name}%`);
    }
    if (filters.is_active !== undefined && filters.is_active !== null) {
      query = query.eq('is_active', filters.is_active);
    }

    query = query
      .order(orderBy, { ascending: orderAsc })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching products list:', error);
      return { success: false, error: `Database error: ${error.message}` };
    }

    return { 
      success: true, 
      data: { 
        products: data as any, 
        totalPages: null,
        count: count || 0 
      } 
    };

  } catch (err: any) {
    console.error('Error in getProductsListAction:', err);
    return { success: false, error: `Server error: ${err.message || 'Unknown error'}` };
  }
};

export async function getProductBySlugAction(params: { 
  slug: string 
}): Promise<ActionResponse<ProductPageData>> { 
  const supabase = createServerComponentClient();
  const { slug } = params;

  if (!slug) {
    return { success: false, error: 'Product slug is required' };
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_images!left(id, image_url, alt_text, position),
        product_variants!left(id, size_name),
        product_categories!left(id, name, size_guide_id, size_guide_templates!left(id, name, guide_data))
      `)
      .eq('slug', slug)
      .eq('is_active', true)
      .order('position', { referencedTable: 'product_images', ascending: true, nullsFirst: false })
      .maybeSingle();

    if (error) {
      console.error(`Error fetching product by slug "${slug}":`, error);
      return { success: false, error: `Database error: ${error.message}` };
    }

    if (!data) {
      return { success: false, error: 'Product not found' };
    }

    const productData = data as ProductWithJoinData;
    
    return { 
      success: true, 
      data: productData as any
    };

  } catch (err: any) {
    console.error(`Error in getProductBySlugAction for slug "${slug}":`, err);
    return { success: false, error: `Server error: ${err.message || 'Unknown error'}` };
  }
}

export const getProductByIdForEdit = async (
  productId: string
): Promise<ProductByIdEditResponse> => {
  const supabase = createServerComponentClient();

  if (!productId) {
    return { success: false, error: 'Product ID is required' };
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_images!left(id, image_url, alt_text, position),
        product_variants!left(id, size_name),
        set_products!left(set_id, sets!left(id, name))
      `)
      .eq('id', productId)
      .order('position', { referencedTable: 'product_images', ascending: true, nullsFirst: false })
      .single();

    if (error) {
      console.error(`Error fetching product for edit with ID "${productId}":`, error);
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Product not found' };
      }
      return { success: false, error: `Database error: ${error.message}` };
    }

    return { success: true, data: data as any };

  } catch (err: any) {
    console.error(`Error in getProductByIdForEdit for ID "${productId}":`, err);
    return { success: false, error: `Server error: ${err.message || 'Unknown error'}` };
  }
}; 