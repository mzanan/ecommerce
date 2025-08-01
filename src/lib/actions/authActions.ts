'use server'

import { createServerActionClient } from "@/lib/supabase/server";
import { redirect } from 'next/navigation'; 
import { AuthError } from "@supabase/supabase-js";
import type { AuthActionResponse } from '@/types/actions';

export async function loginUserAction(
    prevState: AuthActionResponse | null, 
    formData: FormData
): Promise<AuthActionResponse> {
    const supabase = createServerActionClient();

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) return { success: false, error: 'Email and password are required.' };

    const { data: loginData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        console.error('[Auth Action Error] Login failed:', error.message);
        let userMessage = 'Login failed. Please check your credentials.';
        if (error instanceof AuthError && error.message.includes('Invalid login credentials')) {
            userMessage = 'Invalid email or password.';
        }
        return { success: false, error: userMessage };
    }

    if (loginData.user) {
        const { data: adminData } = await supabase
            .from('admin_users')
            .select('full_name')
            .eq('id', loginData.user.id)
            .single();

        if (adminData?.full_name) {
            await supabase.auth.updateUser({
                data: {
                    full_name: adminData.full_name,
                }
            });
        }
    }

    return { success: true, message: 'Login successful!' }; 

}

export async function logoutUserAction(): Promise<void> {
    const supabase = createServerActionClient(); 
    await supabase.auth.signOut();
    redirect('/admin/login'); 
}
