import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ApiResponse, StatsResponse } from '@/types'

// ── GET /api/stats — dashboard statistics for instructor/hod ──────
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json<ApiResponse>({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role === 'student') {
    return NextResponse.json<ApiResponse>({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const courseId = searchParams.get('course_id')

  let query = supabase
    .from('queries')
    .select('status, query_type, section, course_id, is_urgent, sla_due_at, resolved_at, submitted_at')

  if (courseId) query = query.eq('course_id', courseId)

  const { data: rows, error } = await query
  if (error) return NextResponse.json<ApiResponse>({ error: error.message }, { status: 500 })

  const now = Date.now()
  const stats: StatsResponse = {
    total: 0, pending: 0, reviewing: 0, resolved: 0, rejected: 0, escalated: 0,
    urgent: 0, sla_breached: 0, by_type: {}, by_section: {}, by_course: {},
    avg_resolution_hours: 0,
  }

  let totalResolutionMs = 0
  let resolvedCount = 0

  for (const row of rows ?? []) {
    stats.total++
    if (row.status === 'pending')   stats.pending++
    if (row.status === 'reviewing') stats.reviewing++
    if (row.status === 'resolved')  stats.resolved++
    if (row.status === 'rejected')  stats.rejected++
    if (row.status === 'escalated') stats.escalated++
    if (row.is_urgent) stats.urgent++

    // SLA breach: past due_at and not yet resolved/rejected
    if (row.sla_due_at && new Date(row.sla_due_at).getTime() < now &&
        row.status !== 'resolved' && row.status !== 'rejected') {
      stats.sla_breached++
    }

    stats.by_type[row.query_type]    = (stats.by_type[row.query_type]    || 0) + 1
    stats.by_section[row.section]    = (stats.by_section[row.section]    || 0) + 1
    stats.by_course[row.course_id]   = (stats.by_course[row.course_id]   || 0) + 1

    // Average resolution time
    if (row.resolved_at && row.submitted_at) {
      const ms = new Date(row.resolved_at).getTime() - new Date(row.submitted_at).getTime()
      if (ms > 0) { totalResolutionMs += ms; resolvedCount++ }
    }
  }

  stats.avg_resolution_hours = resolvedCount > 0
    ? Math.round(totalResolutionMs / resolvedCount / 3600000 * 10) / 10
    : 0

  return NextResponse.json<ApiResponse<StatsResponse>>({ data: stats })
}
