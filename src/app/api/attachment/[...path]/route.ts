import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types'

// GET /api/attachment/[...path] — returns a short-lived signed URL
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const filePath  = path.join('/')
  const admin     = createAdminClient()

  const { data, error } = await admin.storage
    .from('query-attachments')
    .createSignedUrl(filePath, 300) // 5-minute expiry

  if (error || !data) {
    return NextResponse.json<ApiResponse>({ error: 'Could not generate download link' }, { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl)
}
