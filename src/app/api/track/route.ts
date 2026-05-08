import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types'

// GET /api/track?roll=23I-1234 — public endpoint for students to check query status
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const roll = searchParams.get('roll')?.trim().toUpperCase()

  if (!roll) return NextResponse.json<ApiResponse>({ error: 'roll parameter is required' }, { status: 400 })
  if (roll.length > 20) return NextResponse.json<ApiResponse>({ error: 'Invalid roll number' }, { status: 400 })

  // Use admin client — public endpoint but intentionally limited fields
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('queries')
    .select('reference_id, query_type, status, is_urgent, sla_due_at, submitted_at, resolved_at, course:courses(name, section), instructor_notes')
    .eq('roll_number', roll)
    .order('submitted_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json<ApiResponse>({ error: error.message }, { status: 500 })

  return NextResponse.json<ApiResponse>({ data })
}
