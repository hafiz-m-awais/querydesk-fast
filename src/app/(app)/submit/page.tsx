import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SubmitForm from './SubmitForm'
import type { Course } from '@/types'

export default async function SubmitPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile to get department_id for course filtering
  const { data: profile } = await supabase
    .from('profiles')
    .select('department_id')
    .eq('id', user.id)
    .single()

  let coursesQuery = supabase
    .from('courses')
    .select('*')
    .eq('is_active', true)
    .order('code')

  // Students only see courses in their department
  if (profile?.department_id) {
    coursesQuery = coursesQuery.eq('department_id', profile.department_id)
  }

  const { data: courses } = await coursesQuery

  return (
    <div className="py-4">
      <SubmitForm courses={(courses ?? []) as Course[]} />
    </div>
  )
}
