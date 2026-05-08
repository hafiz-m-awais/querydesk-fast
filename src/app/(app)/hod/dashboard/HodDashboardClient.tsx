'use client'

import { useState, useCallback, useEffect } from 'react'
import StatsCards from '@/components/StatsCards'
import QueryTable from '@/components/QueryTable'
import QueryDetailSheet from '@/components/QueryDetailSheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { Query, QueryStatus, StatsResponse } from '@/types'

export default function HodDashboardClient() {
  const [stats, setStats]       = useState<StatsResponse | null>(null)
  const [queries, setQueries]   = useState<Query[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [filters, setFilters]   = useState<{ status?: string; course_id?: string }>({})
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<Query | null>(null)
  const [tab, setTab]           = useState<'all' | 'sla'>('all')

  const fetchAll = useCallback(async (p: number, f: typeof filters, t: string) => {
    setLoading(true)
    try {
      const [statsRes, queriesRes] = await Promise.all([
        fetch('/api/stats'),
        fetch(`/api/queries?${new URLSearchParams({
          page: String(p),
          limit: '20',
          ...(f.status ? { status: f.status } : {}),
          ...(f.course_id ? { course_id: f.course_id } : {}),
          ...(t === 'sla' ? { sla_breached: '1' } : {}),
        })}`),
      ])
      const [statsJson, queriesJson] = await Promise.all([statsRes.json(), queriesRes.json()])
      setStats(statsJson.data)
      setQueries(queriesJson.data ?? [])
      setTotal(queriesJson.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll(page, filters, tab) }, [page, filters, tab, fetchAll])

  const handleUpdate = useCallback(async (id: string, status: QueryStatus, notes?: string) => {
    await fetch(`/api/queries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, instructor_notes: notes }),
    })
    fetchAll(page, filters, tab)
  }, [page, filters, tab, fetchAll])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HoD Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of all queries and SLA performance</p>
      </div>

      {stats && <StatsCards stats={stats} />}

      <Tabs value={tab} onValueChange={v => { setTab(v as 'all' | 'sla'); setPage(1) }}>
        <TabsList>
          <TabsTrigger value="all">All Queries</TabsTrigger>
          <TabsTrigger value="sla">SLA Breached</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <QueryTable
              queries={queries}
              total={total}
              page={page}
              limit={20}
              onPageChange={setPage}
              onRowClick={setSelected}
              onFilterChange={f => { setFilters(prev => ({ ...prev, ...f })); setPage(1) }}
            />
          )}
        </TabsContent>

        <TabsContent value="sla" className="mt-4">
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <QueryTable
              queries={queries}
              total={total}
              page={page}
              limit={20}
              onPageChange={setPage}
              onRowClick={setSelected}
            />
          )}
        </TabsContent>
      </Tabs>

      <QueryDetailSheet
        query={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onUpdate={handleUpdate}
      />
    </div>
  )
}
