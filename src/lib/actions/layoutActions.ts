'use server';

import { createServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { HomepageLayoutRow } from '@/types/db';

export async function updateHomepageLayoutOrder(items: { item_id: string; display_order: number; item_type: 'page_component' | 'set'; page_path: string }[]): Promise<{ success: boolean, message?: string }> {
    const supabase = createServerActionClient();

    if (!items || items.length === 0) {
        return { success: true, message: 'No items to update.' };
    }

    const pagePath = items[0]?.page_path || '/';

    const rpc_items = items.map(item => ({
        item_id: item.item_id,
        item_type: item.item_type,
        new_display_order: item.display_order,
    }));

    try {
        const { error } = await supabase.rpc('update_homepage_layout_orders' as any, {
            p_page_path: pagePath,
            items_to_insert: rpc_items
        });

        if (error) {
            console.error("[layoutActions.ts] RPC Error calling 'update_homepage_layout_orders':", error);
            throw error;
        }

        revalidatePath('/');
        revalidatePath('/admin/home-design');
        return { success: true, message: 'Layout order updated successfully.' };
    } catch (error: any) {
        const errorMessage = error.message || 'An unknown database error occurred.';
        console.error("[layoutActions.ts] Catch block after RPC call:", errorMessage);
        return { success: false, message: `Database RPC Error: ${errorMessage}` };
    }
}

export async function syncHomepageLayout(pagePath: string = '/'): Promise<{ success: boolean, message?: string, addedCount?: number, removedCount?: number }> {
    const supabase = createServerActionClient();
    let addedCount = 0;

    try {
        const { data: currentLayout, error: layoutError } = await supabase
            .from('homepage_layout')
            .select('item_id, item_type')
            .eq('page_path', pagePath);

        if (layoutError) throw new Error(`Failed to fetch current layout: ${layoutError.message}`);
        const layoutMap = new Map(currentLayout.map(item => [`${item.item_type}:${item.item_id}`, true]));

        const { data: activeComponents, error: componentsError } = await supabase
            .from('page_components')
            .select('id')
            .eq('page_path', pagePath)
            .eq('is_active', true);

        if (componentsError) throw new Error(`Failed to fetch active components: ${componentsError.message}`);

        const { data: activeSets, error: setsError } = await supabase
            .from('sets')
            .select('id, name, type, is_active')
            .eq('is_active', true);

        if (setsError) throw new Error(`Failed to fetch active sets: ${setsError.message}`);

        const missingItems: Omit<HomepageLayoutRow, 'display_order' | 'created_at' | 'updated_at'>[] = [];

        activeComponents?.forEach(comp => {
            if (!layoutMap.has(`page_component:${comp.id}`)) {
                missingItems.push({ item_id: comp.id, item_type: 'page_component', page_path: pagePath });
            }
        });

        activeSets?.forEach(set => {
            if (!layoutMap.has(`set:${set.id}`)) {
                missingItems.push({ item_id: set.id, item_type: 'set', page_path: pagePath });
            }
        });

        if (missingItems.length > 0) {
            const { data: maxOrderData, error: maxOrderError } = await supabase
                .from('homepage_layout')
                .select('display_order')
                .eq('page_path', pagePath)
                .order('display_order', { ascending: false })
                .limit(1);

            if (maxOrderError) throw new Error(`Failed to get max order: ${maxOrderError.message}`);
            let nextOrder = (maxOrderData?.[0]?.display_order ?? -1) + 1;

            const itemsToInsert: any[] = missingItems.map(item => ({
                item_id: item.item_id,
                item_type: item.item_type,
                page_path: item.page_path,
                display_order: nextOrder++,
            }));

            const { error: insertError } = await supabase
                .from('homepage_layout')
                .insert(itemsToInsert);

            if (insertError) {
                 if (insertError.code === '23505') {
                     console.warn(`Sync warning: Potential concurrent addition detected. Re-running sync might be needed.`);
                 } else {
                    throw new Error(`Failed to insert missing items: ${insertError.message}`);
                 }
            } else {
                addedCount = itemsToInsert.length;
            }
        }

        if (addedCount > 0) {
            revalidatePath('/');
            revalidatePath('/admin/home-design');
            return { success: true, message: `Layout synchronized. Added ${addedCount} new items.`, addedCount };
        } else {
            return { success: true, message: 'Layout is already up-to-date.', addedCount: 0 };
        }

    } catch (error: any) {
        return { success: false, message: `Sync Error: ${error.message}` };
    }
}

export async function deleteHomepageItem(itemId: string, itemType: 'page_component' | 'set'): Promise<{ success: boolean, message?: string }> {
    if (!itemId || !itemType) {
        return { success: false, message: 'Item ID and Type are required.' };
    }

    const supabase = createServerActionClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { success: false, message: 'Authentication required.' };
    }
    const { count: adminCount } = await supabase
        .from('admin_users')
        .select('* ', { count: 'exact', head: true })
        .eq('id', user.id);

    if (adminCount !== 1) {
        return { success: false, message: 'Admin authorization required.' };
    }

    try {
        const { error: layoutDeleteError } = await supabase
            .from('homepage_layout')
            .delete()
            .match({ item_id: itemId, page_path: '/' });

        if (layoutDeleteError) {
            console.error('Error deleting from layout:', layoutDeleteError);
        }

        let itemDeleteError: any = null;
        if (itemType === 'page_component') {
            const { error } = await supabase
                .from('page_components')
                .delete()
                .match({ id: itemId });
            itemDeleteError = error;
        } else if (itemType === 'set') {
            const { error } = await supabase
                .from('sets')
                .delete()
                .match({ id: itemId });
            itemDeleteError = error;
        }

        if (itemDeleteError) {
            console.error(`Error deleting ${itemType}:`, itemDeleteError);
            return { success: false, message: `Failed to delete ${itemType}: ${itemDeleteError.message}. Layout entry may also persist.` };
        }

        revalidatePath('/');
        revalidatePath('/admin/home-design');

        return { success: true, message: `Item deleted successfully.` };

    } catch (error: any) {
        console.error('Error deleting homepage item:', error);
        return { success: false, message: `Server Error: ${error.message}` };
    }
} 