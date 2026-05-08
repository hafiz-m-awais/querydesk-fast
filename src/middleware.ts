import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ALLOWED_EMAIL_DOMAINS } from '@/lib/constants'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  // Refresh session
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // ── Allow public routes ────────────────────────────────────────
  const publicPaths = ['/login', '/auth/callback', '/track']
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return supabaseResponse
  }

  // ── Unauthenticated → login ────────────────────────────────────
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ── Domain enforcement: only @nu.edu.pk / @isb.nu.edu.pk ──────
  const emailDomain = user.email?.split('@')[1]?.toLowerCase() ?? ''
  if (!ALLOWED_EMAIL_DOMAINS.includes(emailDomain)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=domain_not_allowed', request.url))
  }

  // ── Role-based route guards ────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, roll_number')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'student'

  // ── Profile completion guard (students need roll_number) ───────
  if (
    role === 'student' &&
    !profile?.roll_number &&
    !pathname.startsWith('/profile') &&
    !pathname.startsWith('/api')
  ) {
    return NextResponse.redirect(new URL('/profile', request.url))
  }

  // Instructor-only routes
  if (pathname.startsWith('/instructor') && role === 'student') {
    return NextResponse.redirect(new URL('/submit', request.url))
  }

  // HoD-only routes
  if (pathname.startsWith('/hod') && !['hod', 'superadmin'].includes(role)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
