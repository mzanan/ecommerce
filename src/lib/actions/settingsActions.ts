'use server';

import { createServerComponentClient } from '@/lib/supabase/server';
import { createServerActionClient } from '@/lib/supabase/server';
import type { ActionResponse } from '@/types/actions';
import type { UpdateSettingResult } from '@/types/settings';

const SETTINGS_TABLE = 'app_settings';

export async function getSetting(key: string): Promise<ActionResponse<{ key: string; value: string | null }>> {
    const supabase = createServerComponentClient();
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('key, value')
            .eq('key', key)
            .maybeSingle(); 
        
        if (error) {
            console.error(`[getSetting] DB error fetching ${key}:`, error);
            return { success: false, error: `Database error: ${error.message}` };
        }
        if (!data) {
            return { success: false, error: 'Setting not found' }; 
        }
        return { success: true, data: data as { key: string; value: string | null } };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[getSetting] Exception fetching ${key}:`, err);
        return { success: false, error: message };
    }
}



export async function updateSetting(key: string, value: string): Promise<UpdateSettingResult> {
    const supabase = createServerActionClient();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { success: false, error: 'Authentication required.' };
        }

        const { error } = await supabase
            .from(SETTINGS_TABLE)
            .upsert({ key, value }, { onConflict: 'key' }); 

        if (error) {
            if (error.code === '42501') {
                 console.error(`RLS Error updating setting '${key}': User ${user.id} likely not in admin_users table.`);
                 return { success: false, error: 'Permission denied. Ensure you are an administrator.' };
            }
            console.error(`Error updating setting '${key}':`, JSON.stringify(error, null, 2));
            return { success: false, error: `Database error: ${error.message}` };
        }

        return { success: true };

    } catch (err: any) {
        console.error(`Unexpected error updating setting '${key}':`, err);
        return { success: false, error: `Server error: ${err.message || 'Unknown error'}` };
    }
} 