import { createClient } from "@/lib/supabase/client";
import type { 
    AdminSetListItem,
    AdminSetsListResult 
} from '@/types/sets';
import type { SetType } from '@/lib/schemas/setSchema';
import type { 
    AdminSetsListParams
} from '@/types/setActions';

export const getAdminSetsList = async (params: AdminSetsListParams = {}): Promise<AdminSetsListResult> => {
    const supabase = createClient();
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
            console.error("Count query error:", countError);
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
                console.error("Product counts error:", simpleCountsError);
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