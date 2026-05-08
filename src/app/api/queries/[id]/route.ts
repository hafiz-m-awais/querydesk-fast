import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateStatusSchema } from '@/lib/validations'
import { sendStatusNotification, sendEscalationAlert } from '@/lib/email'
import type { ApiResponse } from '@/types'

type Params = { params: Promise<{ id: string }> }

// ── GET /api/queries/[id] — fetch single query with history ───────
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json<ApiResponse>({ error: 'Unauthorised' }, { status: 401 })

  const { data: query, error } = await supabase
    .from('queries')
    .select(`
      *,
      course:courses(id, name, code, section, term, session_label, sla_response_hours),
      student:profiles!queries_student_id_fkey(id, full_name, roll_number, avatar_url)
    `)
    .eq('id', id)
    .single()

  if (error || !query) return NextResponse.json<ApiResponse>({ error: 'Query not found' }, { status: 404 })

  const { data: history } = await supabase
    .from('query_history')
    .select('*, actor:profiles!query_history_actor_id_fkey(id, full_name, role)')
    .eq('query_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json<ApiResponse>({ data: { ...query, history: history ?? [] } })
}

// ── PATCH /api/queries/[id] — update status + notes ──────────────
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json<ApiResponse>({ error: 'Unauthorised' }, { status: 401 })
  }

  // Only staff can update
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const staffRoles = ['ta', 'instructor', 'coordinator', 'hod', 'superadmin']
  if (!profile || !staffRoles.includes(profile.role)) {
    return NextResponse.json<ApiResponse>({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json<ApiResponse>({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateStatusSchema.safeParse({ ...body as object, query_id: id })
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.errors.map(e => e.message).join('; ') }, { status: 422 })
  }

  const { status, instructor_notes } = parsed.data

  // Fetch current query for audit
  const { data: existing } = await supabase.from('queries').select('*').eq('id', id).single()
  if (!existing) return NextResponse.json<ApiResponse>({ error: 'Query not found' }, { status: 404 })

  // Build update payload
  const updatePayload: Record<string, unknown> = {
    status,
    instructor_notes: instructor_notes ?? existing.instructor_notes,
    updated_at: new Date().toISOString(),
  }
  if (status === 'resolved' || status === 'rejected') {
    updatePayload.resolved_by = user.id
    updatePayload.resolved_at = new Date().toISOString()
  }
  if (status === 'escalated') {
    updatePayload.escalated_at = new Date().toISOString()
  }

  const { error: updateError } = await supabase.from('queries').update(updatePayload).eq('id', id)
  if (updateError) return NextResponse.json<ApiResponse>({ error: updateError.message }, { status: 500 })

  // Audit log
  await supabase.from('query_history').insert({
    query_id:   id,
    actor_id:   user.id,
    action:     'status_changed',
    old_status: existing.status,
    new_status: status,
    note:       instructor_notes ?? '',
  })

  // Notifications
  const updatedQuery = { ...existing, status, instructor_notes: instructor_notes ?? existing.instructor_notes }

  if (status === 'resolved' || status === 'rejected' || status === 'escalated') {
    const { data: course } = await supabase.from('courses').select('*').eq('id', existing.course_id).single()
    if (course) {
      sendStatusNotification(updatedQuery, course).catch(console.error)
    }

    // SLA escalation email to HoD
    if (status === 'escalated') {
      const { data: dept } = await supabase
        .from('departments')
        .select('*, hod:profiles!departments_hod_id_fkey(email)')
        .eq('id', course?.department_id)
        .single()

      const hodEmail = (dept as unknown as { hod?: { email?: string } })?.hod?.email
      if (course && hodEmail) {
        sendEscalationAlert(updatedQuery, course, hodEmail).catch(console.error)
      }
    }
  }

  // In-app notification for student
  await supabase.from('notifications').insert({
    recipient_id: existing.student_id,
    query_id:     id,
    title:        `Query ${status}`,
    message:      `Your query ${existing.reference_id} has been marked as ${status}.`,
  })

  return NextResponse.json<ApiResponse>({ message: 'Updated successfully.' })
}

// ── DELETE /api/queries/[id] — hard delete (hod/superadmin only) ──
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json<ApiResponse>({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['hod', 'superadmin'].includes(profile.role)) {
    return NextResponse.json<ApiResponse>({ error: 'Forbidden' }, { status: 403 })
  }

  // Audit BEFORE delete (FK is ON DELETE CASCADE — row would vanish)
  await supabase.from('query_history').insert({
    query_id: id, actor_id: user.id, action: 'deleted',
  })

  const { error } = await supabase.from('queries').delete().eq('id', id)
  if (error) return NextResponse.json<ApiResponse>({ error: error.message }, { status: 500 })

  return NextResponse.json<ApiResponse>({ message: 'Deleted.' })
}
