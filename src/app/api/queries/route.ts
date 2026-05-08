import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { submitQuerySchema } from '@/lib/validations'
import { sendSubmitConfirmation, sendInstructorAlert } from '@/lib/email'
import { MAX_ATTACHMENT_MB, ALLOWED_ATTACHMENT_MIMES, MAX_SUBMISSIONS_PER_HOUR } from '@/lib/constants'
import type { ApiResponse } from '@/types'

// ── GET /api/queries — instructor fetches queries for their courses ─
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json<ApiResponse>({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role === 'student') {
    return NextResponse.json<ApiResponse>({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const courseId  = searchParams.get('course_id')
  const status    = searchParams.get('status')
  const page      = Math.max(1, parseInt(searchParams.get('page')  || '1',  10) || 1)
  const limit     = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50), 100)
  const offset    = (page - 1) * limit

  let query = supabase
    .from('queries')
    .select(`
      *,
      course:courses(id, name, code, section, session_label),
      student:profiles!queries_student_id_fkey(id, full_name, roll_number, avatar_url)
    `, { count: 'exact' })
    .order('submitted_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Non-HoD staff are scoped to their own courses only
  const hodRoles = ['hod', 'superadmin']
  if (!hodRoles.includes(profile.role)) {
    const { data: assignedCourses } = await supabase
      .from('courses')
      .select('id')
      .eq('instructor_id', user.id)
      .eq('is_active', true)

    const courseIds = (assignedCourses ?? []).map(c => c.id)
    if (courseIds.length === 0) {
      // No assigned courses → return empty result immediately
      return NextResponse.json({ data: [], total: 0, page, limit })
    }
    query = query.in('course_id', courseIds)
  }

  if (courseId) query = query.eq('course_id', courseId)
  if (status)   query = query.eq('status', status)
  if (searchParams.get('sla_breached') === '1') {
    query = query.lt('sla_due_at', new Date().toISOString()).not('status', 'in', '(resolved,rejected)')
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json<ApiResponse>({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, total: count, page, limit })
}

// ── POST /api/queries — student submits a new query ───────────────
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json<ApiResponse>({ error: 'Unauthorised' }, { status: 401 })
  }

  // Fetch profile (need roll_number, name, section)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json<ApiResponse>({ error: 'Profile not found. Complete your profile first.' }, { status: 400 })
  }

  if (profile.role !== 'student') {
    return NextResponse.json<ApiResponse>({ error: 'Only students can submit queries.' }, { status: 403 })
  }

  // Parse & validate body
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json<ApiResponse>({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = submitQuerySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.errors.map(e => e.message).join('; ') }, { status: 422 })
  }

  const d = parsed.data

  // Fetch course to validate it exists and is active
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('*, department:departments(campus_id, code, name)')
    .eq('id', d.course_id)
    .eq('is_active', true)
    .single()

  if (courseError || !course) {
    return NextResponse.json<ApiResponse>({ error: 'Course not found or inactive.' }, { status: 404 })
  }

  // Server-side rate limit via Supabase (count submissions in last hour)
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
  const { count: recentCount } = await supabase
    .from('queries')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', user.id)
    .gte('submitted_at', oneHourAgo)

  if ((recentCount ?? 0) >= MAX_SUBMISSIONS_PER_HOUR) {
    return NextResponse.json<ApiResponse>({ error: 'Too many submissions. Please wait before submitting again.' }, { status: 429 })
  }

  // Duplicate guard (same type + session within 24h)
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString()
  const { count: dupCount } = await supabase
    .from('queries')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', user.id)
    .eq('course_id', d.course_id)
    .eq('query_type', d.query_type)
    .eq('session_number', d.session_number ?? '')
    .gte('submitted_at', oneDayAgo)

  if ((dupCount ?? 0) > 0) {
    return NextResponse.json<ApiResponse>({ error: 'A query of this type for the same session was already submitted today.' }, { status: 409 })
  }

  // Attachment upload to Supabase Storage
  let attachmentPath: string | null = null
  let attachmentName: string | null = null
  let attachmentMime: string | null = null

  const rawBody = body as Record<string, unknown>
  if (rawBody.attachment) {
    const att = rawBody.attachment as { name: string; mime: string; data: string; size: number }
    if (!ALLOWED_ATTACHMENT_MIMES.includes(att.mime)) {
      return NextResponse.json<ApiResponse>({ error: `File type not allowed: ${att.mime}` }, { status: 422 })
    }

    // Decode base64 and validate size from actual buffer (not client-supplied value)
    const buffer = Buffer.from(att.data, 'base64')
    if (buffer.length > MAX_ATTACHMENT_MB * 1024 * 1024) {
      return NextResponse.json<ApiResponse>({ error: `File exceeds ${MAX_ATTACHMENT_MB} MB limit` }, { status: 422 })
    }
    const path   = `${user.id}/${Date.now()}_${att.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const adminSupa = createAdminClient()
    const { error: uploadError } = await adminSupa.storage
      .from('query-attachments')
      .upload(path, buffer, { contentType: att.mime, upsert: false })

    if (uploadError) {
      return NextResponse.json<ApiResponse>({ error: 'File upload failed: ' + uploadError.message }, { status: 500 })
    }

    attachmentPath = path
    attachmentName = att.name
    attachmentMime = att.mime
  }

  // Insert query
  const { data: newQuery, error: insertError } = await supabase
    .from('queries')
    .insert({
      course_id:       d.course_id,
      student_id:      user.id,
      student_email:   user.email!,
      student_name:    profile.full_name ?? '',
      roll_number:     profile.roll_number ?? '',
      section:         course.section,
      query_type:      d.query_type,
      session_number:  d.session_number  ?? null,
      session_date:    d.session_date    ?? null,
      description:     d.description,
      extra_date:      d.extra_date      ?? null,
      marks_awarded:   d.marks_awarded   ?? null,
      marks_expected:  d.marks_expected  ?? null,
      issue_reason:    d.issue_reason    ?? null,
      request_type:    d.request_type    ?? null,
      is_urgent:       d.is_urgent,
      attachment_path: attachmentPath,
      attachment_name: attachmentName,
      attachment_mime: attachmentMime,
    })
    .select()
    .single()

  if (insertError || !newQuery) {
    return NextResponse.json<ApiResponse>({ error: insertError?.message ?? 'Insert failed' }, { status: 500 })
  }

  // Audit log
  await supabase.from('query_history').insert({
    query_id:   newQuery.id,
    actor_id:   user.id,
    action:     'submitted',
    new_status: 'pending',
    note:       `${d.query_type} query submitted`,
  })

  // Emails (non-blocking)
  const fullCourse = { ...course, instructor: undefined }
  sendSubmitConfirmation(newQuery, fullCourse as never, profile as never).catch(console.error)

  if (course.instructor_id) {
    const { data: instructorProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', course.instructor_id)
      .single()

    if (instructorProfile?.email) {
      sendInstructorAlert(newQuery, fullCourse as never, instructorProfile.email).catch(console.error)
    }
  }

  return NextResponse.json<ApiResponse>({ data: { reference_id: newQuery.reference_id }, message: 'Query submitted successfully.' }, { status: 201 })
}
