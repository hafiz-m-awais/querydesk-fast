import { createBrowserClient } from '@supabase/ssr'

// Client-side Supabase client (use in Client Components)
// Supports both new publishable key (sb_publishable_xxx) and legacy anon key
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  )
}
