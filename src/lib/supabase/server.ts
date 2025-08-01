import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

export type { Database };

function createBaseServerClient(supabaseKey: string, cookieOptions: {
    getAll: () => Promise<{ name: string; value: string; }[]>;
    setAll?: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => Promise<void>;
}) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey,
    {
      cookies: cookieOptions,
    }
  );
}

export function createServerComponentClient() {
  return createBaseServerClient(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    getAll: async () => {
      const cookieStore = await cookies();
      return cookieStore.getAll();
    },
    setAll: async () => {
    }
  });
}


export function createServerActionClient() {
  return createBaseServerClient(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    getAll: async () => {
      const cookieStore = await cookies();
      return cookieStore.getAll();
    },
    setAll: async (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        const cookieStore = await cookies();
        cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...options });
        });
    }
  });
}


export function createServiceRoleClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
  }
   return createBaseServerClient(process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    getAll: async () => {
      const cookieStore = await cookies();
      return cookieStore.getAll();
    },
     setAll: async (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        const cookieStore = await cookies();
        cookiesToSet.forEach(({ name, value, options }) => {
             cookieStore.set({ name, value, ...options });
        });
    }
  });
}