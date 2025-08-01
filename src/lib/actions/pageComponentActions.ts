'use server';

import { createServerActionClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import type { PageComponentUpdate, PageComponentContent } from "@/types/db"; 
import { type ActionResponse } from "@/types/actions";
import type { OrderUpdate } from "@/types/pageComponent";

async function verifyAdmin(supabase: ReturnType<typeof createServerActionClient>): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { count } = await supabase
        .from('admin_users')
        .select('* ', { count: 'exact', head: true })
        .eq('id', user.id);
    return count === 1;
}

export async function updatePageComponentOrder(updates: OrderUpdate[]): Promise<ActionResponse> {
    if (!updates || updates.length === 0) {
        return { success: true, message: "No updates provided." };
    }

    const supabase = createServerActionClient(); 
    const componentIds = updates.map(u => u.id);

    try {
        let updateFailed = false;
        let firstErrorMessage = 'Unknown error saving order.';
        let successfulUpdates = 0;

        for (let index = 0; index < updates.length; index++) {
            const updateData = updates[index];
            if (!updateData) continue; 

            const { error: dbError } = await supabase
                .from('page_components')
                .update({ display_order: updateData.display_order })
                .eq('id', updateData.id)
                .select('id')
                .single(); 

            if (dbError) {
                updateFailed = true;
                const itemId = updateData.id.substring(0,6);
                firstErrorMessage = dbError.message || `DB error updating item ${itemId}`;
                console.error(`[Server Action Error] DB Error [${index}] for item ${itemId}:`, dbError);
                break; 
            } else {
                 successfulUpdates++;
            }
        }

        if (updateFailed) {
            console.error("[Server Action] Update failed overall:", firstErrorMessage);
            return { success: false, message: `Failed to save full order: ${firstErrorMessage}` };
        } else {
            const { error: verificationError } = await supabase
                .from('page_components')
                .select('id, display_order')
                .in('id', componentIds)
                .order('display_order', { ascending: true });

            if (verificationError) {
                console.error("[Server Action Verification Error]:", verificationError);
            }

            revalidatePath('/');
            revalidateTag('page-components');
            return { success: true, message: `Successfully updated order for ${successfulUpdates} components.` };
        }

    } catch (error: any) {
        console.error("[Server Action Error] updatePageComponentOrder general catch:", error);
        return { success: false, message: error.message || "Failed to create page component due to database error." };
    }
}

export async function updatePageComponent(
    id: string,
    updates: { content?: PageComponentContent; affiliation?: string }
): Promise<{ success: boolean; message?: string; data?: any }> {
    const supabase = createServerActionClient();

    if (!id) {
        return { success: false, message: 'Component ID is required.' };
    }

    const isAdmin = await verifyAdmin(supabase);
    if (!isAdmin) {
        return { success: false, message: 'Admin authorization required.' };
    }

    const updateData: PageComponentUpdate = {};
    if (updates.content) {
        updateData.content = updates.content;
    }
    if (updates.affiliation) {
        updateData.affiliation = updates.affiliation;
    }

    if (Object.keys(updateData).length === 0) {
        return { success: false, message: 'No valid update fields provided.' };
    }
    
    updateData.updated_at = new Date().toISOString();

    try {
        const { data: componentTypeCheck, error: typeCheckError } = await supabase
            .from('page_components')
            .select('type')
            .eq('id', id)
            .single();

        if (typeCheckError) {
            console.error("Error checking component type before update:", typeCheckError);
            return { success: false, message: `Database Error: ${typeCheckError.message}` };
        }

        if (componentTypeCheck && componentTypeCheck.type === 'about') {
            console.warn(`Attempted to update 'about' component (ID: ${id}) through general update. Denied.`);
            return { success: false, message: "Cannot update 'about' components here. Use the dedicated About section admin page." };
        }

        const { data, error } = await supabase
            .from('page_components')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        revalidatePath('/');
        revalidatePath('/admin/home-design');
        return { success: true, message: 'Page component updated.', data };

    } catch (error: any) {
        console.error("Error updating page component:", error);
        return { success: false, message: `Database Error: ${error.message}` };
    }
} 