'use server';

import { createServerActionClient } from "@/lib/supabase/server";
import type { ActionResponse } from '@/types/actions';
import type { PageComponent, PageComponentContent } from '@/types/db';
import type { PageComponentType } from '@/types/homeDesign';

export async function getHomepageLayoutDataAction(pagePath: string): Promise<ActionResponse<any[]>> {
    const supabase = createServerActionClient();
    try {
        const { data, error } = await supabase
            .from('homepage_layout')
            .select('*')
            .eq('page_path', pagePath)
            .order('display_order', { ascending: true });

        if (error) {
            console.error('[Server Action Error] getHomepageLayoutDataAction:', error);
            return { success: false, error: `Database error: ${error.message}` };
        }

        return { success: true, data: data || [] };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error('[Server Action Error] getHomepageLayoutDataAction catch:', message);
        return { success: false, error: message };
    }
}

export async function createPageComponentAction(args: {
    title: string;
    text: string;
    affiliation: 'FIDELI' | 'INFIDELI';
    pagePath?: string;
    type?: PageComponentType;
}): Promise<ActionResponse<PageComponent>> {
    const { title, text, affiliation, pagePath = '/', type = 'text' } = args;

    const supabase = createServerActionClient();

    try {
        const { data: lastOrderedComponent, error: fetchError } = await supabase
            .from('homepage_layout')
            .select('display_order')
            .eq('page_path', pagePath)
            .order('display_order', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();

        if (fetchError) {
            console.error("[Server Action Error] createPageComponentAction - fetch display_order failed:", fetchError);
            throw new Error(`Failed to calculate next display_order: ${fetchError.message}`);
        }

        let nextDisplayOrder = 0;
        if (lastOrderedComponent && typeof lastOrderedComponent.display_order === 'number') {
            nextDisplayOrder = lastOrderedComponent.display_order + 1;
        }

        const derivedBgTheme = affiliation === 'FIDELI' ? 'light' : 'dark';
        const content: PageComponentContent = {
            title: title || undefined,
            text: text,
            bgTheme: derivedBgTheme
        };

        const defaultPosition = { x: 0, y: nextDisplayOrder }; 

        const { data: newDbComponent, error: insertError } = await supabase
            .from('page_components')
            .insert({ 
                type: type, 
                content, 
                page_path: pagePath, 
                is_active: true, 
                affiliation: affiliation,
                display_order: nextDisplayOrder, 
                position: defaultPosition
            })
            .select()
            .single();

        if (insertError || !newDbComponent) {
            console.error("[Server Action Error] createPageComponentAction - insert failed:", insertError);
            return { success: false, error: insertError?.message || 'Failed to create page component.' };
        }

        const { error: layoutInsertError } = await supabase
            .from('homepage_layout')
            .insert({
                item_id: newDbComponent.id,
                item_type: 'page_component',
                display_order: nextDisplayOrder,
                page_path: pagePath,
            });
        
        if (layoutInsertError) {
            console.error("[Server Action Error] createPageComponentAction - layout insert failed:", layoutInsertError);

            await supabase.from('page_components').delete().eq('id', newDbComponent.id);
            return { success: false, error: `Failed to add component to layout: ${layoutInsertError.message}` };
        }

        return { success: true, data: newDbComponent as PageComponent };

    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error('[Server Action Error] createPageComponentAction catch:', message);
        return { success: false, error: message };
    }
}

export async function getPageComponentsByIdsAction(componentIds: string[]): Promise<ActionResponse<PageComponent[]>> {
    if (!componentIds || componentIds.length === 0) {
        return { success: true, data: [] };
    }
    const supabase = createServerActionClient();
    try {
        const { data, error } = await supabase
            .from('page_components')
            .select('*, affiliation')
            .in('id', componentIds);
        
        if (error) {
            return { success: false, error: `Database error: ${error.message}` };
        }

        return { success: true, data };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return { success: false, error: message };
    }
} 