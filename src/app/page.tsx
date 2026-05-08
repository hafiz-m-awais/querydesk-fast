import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Root: redirect based on auth state and role
export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'student'

  if (role === 'student') redirect('/submit')
  if (['hod', 'superadmin'].includes(role)) redirect('/hod/dashboard')
  redirect('/instructor/dashboard')
}
