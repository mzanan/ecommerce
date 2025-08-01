'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type { AdminUserActionResult } from '@/types/adminUser';

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase URL or Service Role Key is missing')
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function createAdminUserAction(
  prevState: AdminUserActionResult | null,
  formData: FormData,
): Promise<AdminUserActionResult> {
  const supabaseAdmin = createAdminClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string

  if (!email || !password) {
    return { success: false, message: 'Email and password are required.' }
  }

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (authError) {
      console.error('[Server Action Error] Supabase Auth Create:', authError.message);
      return { success: false, message: `Auth Error: ${authError.message}` }
    }

    if (!authData || !authData.user) {
        return { success: false, message: 'User created in Auth but no data returned.' };
    }

    const userId = authData.user.id;

    const { error: profileError } = await supabaseAdmin
      .from('admin_users')
      .insert({
        id: userId,
        full_name: fullName || null,
      })

    if (profileError) {
       console.error('[Server Action Error] Supabase Profile Insert:', profileError.message);
      await supabaseAdmin.auth.admin.deleteUser(userId)
      console.warn(`Auth user ${userId} deleted due to profile insert failure.`);
      return { success: false, message: `Profile Error: ${profileError.message}` }
    }

    revalidatePath('/admin/users')
    return { 
      success: true, 
      message: `Admin user ${email} created successfully.`,
      userId: userId
    }

  } catch (error) {
    const typedError = error instanceof Error ? error : new Error('Unknown error');
    console.error('[Server Action Error] Unexpected:', typedError);
            return { success: false, message: `Failed to save admin user due to database error: ${typedError.message}` }
  }
} 