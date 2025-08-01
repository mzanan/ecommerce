import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options });
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const authRedirectPaths = ['/admin/login']
  const protectedPaths = ['/admin/dashboard', '/admin/products', '/admin/sets', '/admin/size-guides', '/admin/disclaimer']

  if (user) {
    if (authRedirectPaths.includes(pathname)) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
  } 
  else {
    if (protectedPaths.some(path => pathname.startsWith(path))) {
         return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  return response
} 