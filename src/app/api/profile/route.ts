import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { ROLL_NUMBER_RE } from '@/lib/constants'
import type { ApiResponse } from '@/types'

const patchSchema = z.object({
  full_name:     z.string().min(2).max(100).optional(),
  roll_number:   z.string().regex(ROLL_NUMBER_RE, 'Format: 23I-1234').optional().nullable(),
  campus_id:     z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  batch_year:    z.coerce.number().int().min(2000).max(2099).optional().nullable(),
})

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json<ApiResponse>({ error: 'Unauthorised' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json<ApiResponse>({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>({ error: parsed.error.errors.map(e => e.message).join('; ') }, { status: 422 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return NextResponse.json<ApiResponse>({ error: error.message }, { status: 500 })

  return NextResponse.json<ApiResponse>({ message: 'Profile updated.' })
}
