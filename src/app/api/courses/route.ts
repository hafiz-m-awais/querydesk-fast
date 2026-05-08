import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types'

// GET /api/courses — list active courses (filtered by dept for students)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json<ApiResponse>({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, department_id')
    .eq('id', user.id)
    .single()

  const { searchParams } = new URL(request.url)
  const departmentId = searchParams.get('department_id') ?? profile?.department_id

  let query = supabase
    .from('courses')
    .select('id, code, name, term, section, session_label, session_count, enabled_query_types, sla_response_hours, instructor:profiles!courses_instructor_id_fkey(id, full_name)')
    .eq('is_active', true)
    .order('name')

  // Students only see their department's courses
  if (profile?.role === 'student' && departmentId) {
    query = query.eq('department_id', departmentId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json<ApiResponse>({ error: error.message }, { status: 500 })

  return NextResponse.json<ApiResponse>({ data })
}
