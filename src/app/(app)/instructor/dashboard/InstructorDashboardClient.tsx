'use client'

import { useState, useCallback, useEffect } from 'react'
import QueryTable from '@/components/QueryTable'
import QueryDetailSheet from '@/components/QueryDetailSheet'
import type { Query, QueryStatus } from '@/types'

export default function InstructorDashboardClient() {
  const [queries, setQueries]   = useState<Query[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [filters, setFilters]   = useState<{ status?: string; course_id?: string }>({})
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<Query | null>(null)

  const fetchQueries = useCallback(async (p: number, f: typeof filters) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (f.status)    params.set('status', f.status)
      if (f.course_id) params.set('course_id', f.course_id)
      const res = await fetch(`/api/queries?${params}`)
      const json = await res.json()
      setQueries(json.data ?? [])
      setTotal(json.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchQueries(page, filters) }, [page, filters, fetchQueries])

  const handleUpdate = useCallback(async (id: string, status: QueryStatus, notes?: string) => {
    await fetch(`/api/queries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, instructor_notes: notes }),
    })
    fetchQueries(page, filters)
  }, [page, filters, fetchQueries])

  const handleBulk = useCallback(async (ids: string[], status: QueryStatus) => {
    await fetch('/api/queries/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status }),
    })
    fetchQueries(page, filters)
  }, [page, filters, fetchQueries])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Manage student queries</p>
      </div>

      {loading && queries.length === 0 ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <QueryTable
          queries={queries}
          total={total}
          page={page}
          limit={20}
          onPageChange={setPage}
          onRowClick={setSelected}
          onBulkUpdate={handleBulk}
          onFilterChange={f => { setFilters(prev => ({ ...prev, ...f })); setPage(1) }}
        />
      )}

      <QueryDetailSheet
        query={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onUpdate={handleUpdate}
      />
    </div>
  )
}
