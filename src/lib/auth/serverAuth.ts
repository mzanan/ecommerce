import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { createServerActionClient } from '@/lib/supabase/server';

/**
 * Convenience guard for server actions: verifies the current session belongs to an
 * admin using the cookie-bound client. Use at the top of every mutating admin action,
 * especially service-role ones (which bypass RLS).
 */
export async function requireAdmin(): Promise<boolean> {
  return verifyAdmin(createServerActionClient());
}

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