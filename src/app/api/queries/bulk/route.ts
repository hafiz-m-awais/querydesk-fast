import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { bulkUpdateSchema } from '@/lib/validations'
import { sendStatusNotification } from '@/lib/email'
import type { ApiResponse } from '@/types'

// ── POST /api/queries/bulk — update multiple queries at once ──────
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json<ApiResponse>({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['instructor', 'coordinator', 'hod', 'superadmin'].includes(profile.role)) {
    return NextResponse.json<ApiResponse>({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json<ApiResponse>({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bulkUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.errors.map(e => e.message).join('; ') }, { status: 422 })
  }

  const { query_ids, status, notes } = parsed.data

  // Fetch all targeted queries to verify ownership and for email
  const { data: queries, error: fetchError } = await supabase
    .from('queries')
    .select('*, course:courses(*)')
    .in('id', query_ids)

  if (fetchError) return NextResponse.json<ApiResponse>({ error: fetchError.message }, { status: 500 })

  const resolvedAt = (status === 'resolved' || status === 'rejected') ? new Date().toISOString() : null

  const updatePayload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    ...(notes ? { instructor_notes: notes } : {}),
    ...(resolvedAt ? { resolved_at: resolvedAt, resolved_by: user.id } : {}),
  }

  const { error: updateError } = await supabase
    .from('queries')
    .update(updatePayload)
    .in('id', query_ids)

  if (updateError) return NextResponse.json<ApiResponse>({ error: updateError.message }, { status: 500 })

  // Audit log + notifications
  const historyRows = query_ids.map(qid => {
    const q = queries?.find(r => r.id === qid)
    return { query_id: qid, actor_id: user.id, action: 'status_changed', old_status: q?.status ?? null, new_status: status, note: notes ?? '' }
  })
  await supabase.from('query_history').insert(historyRows)

  // Send status emails for resolved/rejected
  if (resolvedAt && queries) {
    for (const q of queries) {
      const updatedQ = { ...q, status, instructor_notes: notes ?? q.instructor_notes }
      if (q.course) {
        sendStatusNotification(updatedQ, q.course).catch(console.error)
      }
    }
  }

  return NextResponse.json<ApiResponse>({ message: `Updated ${query_ids.length} queries.`, data: { updated: query_ids.length } })
}
