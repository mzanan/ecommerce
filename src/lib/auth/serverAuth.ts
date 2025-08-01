import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';


export async function verifyAdmin(supabase: SupabaseClient<Database>): Promise<boolean> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
        console.error("Error fetching user for admin verification:", authError);
        return false;
    }
    if (!user) {
        return false;
    }

    try {
        const { data: adminUser, error: dbError } = await supabase
            .from('admin_users')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

        if (dbError) {
            console.error("Database error verifying admin status:", dbError);
            return false;
        }
        
        return adminUser !== null;
    } catch (e) {
        console.error("Unexpected error during admin verification:", e);
        return false;
    }
} 