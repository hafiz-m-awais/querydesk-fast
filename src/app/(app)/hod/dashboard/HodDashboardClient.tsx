'use client'

import { useState, useCallback, useEffect } from 'react'
import StatsCards from '@/components/StatsCards'
import QueryTable from '@/components/QueryTable'
import QueryDetailSheet from '@/components/QueryDetailSheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { apiFetch } from '@/lib/api'
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
      const queryParams = new URLSearchParams({
        page: String(p), limit: '20',
        ...(f.status    ? { status: f.status }       : {}),
        ...(f.course_id ? { course_id: f.course_id } : {}),
        ...(t === 'sla' ? { sla_breached: '1' }      : {}),
      })
      const [statsJson, queriesJson] = await Promise.all([
        apiFetch<{ data: StatsResponse }>('/stats'),
        apiFetch<{ data: Query[]; total: number }>(`/queries?${queryParams}`),
      ])
      setStats(statsJson.data)
      setQueries(queriesJson.data ?? [])
      setTotal(queriesJson.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll(page, filters, tab) }, [page, filters, tab, fetchAll])

  const handleUpdate = useCallback(async (id: string, status: QueryStatus, notes?: string) => {
    await apiFetch(`/queries/${id}`, {
      method: 'PATCH',
      body: { status, instructor_notes: notes },
    })
    fetchAll(page, filters, tab)
  }, [page, filters, tab, fetchAll])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor all queries, SLA compliance, and department activity
          </p>
        </div>
        <span className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 font-medium">
          HoD View
        </span>
      </div>

      {/* Stats */}
      {stats && <StatsCards stats={stats} />}

      {/* Queries table */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-foreground text-sm">Query Management</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Review, update status, and resolve student queries</p>
        </div>

        <div className="p-4">
          <Tabs value={tab} onValueChange={v => { setTab(v as 'all' | 'sla'); setPage(1) }}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Queries</TabsTrigger>
              <TabsTrigger value="sla" className="data-[state=active]:bg-red-50 data-[state=active]:text-red-700">
                SLA Breached {stats?.sla_breached ? `(${stats.sla_breached})` : ''}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Loading queries…
                </div>
              ) : (
                <QueryTable
                  queries={queries} total={total} page={page} limit={20}
                  onPageChange={setPage} onRowClick={setSelected}
                  onFilterChange={f => { setFilters(prev => ({ ...prev, ...f })); setPage(1) }}
                />
              )}
            </TabsContent>

            <TabsContent value="sla">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Loading queries…
                </div>
              ) : (
                <QueryTable
                  queries={queries} total={total} page={page} limit={20}
                  onPageChange={setPage} onRowClick={setSelected}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <QueryDetailSheet
        query={selected} open={!!selected}
        onClose={() => setSelected(null)} onUpdate={handleUpdate}
      />
    </div>
  )
}
