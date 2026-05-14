/**
 * Centralised API client.
 *
 * All data requests go to NEXT_PUBLIC_API_URL (FastAPI backend).
 * The Supabase access token is automatically attached as a Bearer header.
 * Auth-only flows (OAuth callback) remain in Next.js.
 */
import { createClient } from '@/lib/supabase/client'

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  /** Skip auth header (public endpoints like /track) */
  public?: boolean
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { body, public: isPublic, ...rest } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string> | undefined),
  }

  if (!isPublic) {
    const token = await getAccessToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!response.ok) {
    const json = await response.json().catch(() => ({}))
    const message =
      json?.detail ?? json?.error ?? `API error ${response.status}`
    throw new Error(message)
  }

  return response.json() as Promise<T>
}
