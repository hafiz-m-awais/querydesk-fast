import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileForm from './ProfileForm'
import type { Campus, Department, Profile } from '@/types'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: campuses }, { data: departments }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single<Profile>(),
    supabase.from('campuses').select('*').eq('is_active', true).order('name'),
    supabase.from('departments').select('*').eq('is_active', true).order('name'),
  ])

  if (!profile) redirect('/login')

  return <ProfileForm profile={profile} campuses={campuses ?? []} departments={departments ?? []} />
}
