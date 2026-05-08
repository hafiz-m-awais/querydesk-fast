'use client'

import { useState, useCallback, useEffect } from 'react'
import StatusBadge from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { QUERY_STATUSES, QUERY_TYPE_LABELS } from '@/lib/constants'
import type { Query, QueryStatus } from '@/types'

interface QueryTableProps {
  queries:    Query[]
  total:      number
  page:       number
  limit:      number
  onPageChange:  (page: number) => void
  onRowClick:    (q: Query) => void
  onBulkUpdate?: (ids: string[], status: QueryStatus) => Promise<void>
  onFilterChange?: (filters: { status?: string; course_id?: string }) => void
  courses?: { id: string; name: string; section: string }[]
}

export default function QueryTable({
  queries, total, page, limit,
  onPageChange, onRowClick, onBulkUpdate, onFilterChange, courses,
}: QueryTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<QueryStatus>('resolved')
  const [doing, setDoing] = useState(false)

  // Clear selections whenever the visible query set changes (page turn / filter change)
  useEffect(() => {
    setSelected(new Set())
  }, [queries])

  const toggleAll = useCallback((checked: boolean) => {
    setSelected(checked ? new Set(queries.map(q => q.id)) : new Set())
  }, [queries])

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }, [])

  const handleBulk = useCallback(async () => {
    if (!onBulkUpdate || selected.size === 0) return
    setDoing(true)
    try { await onBulkUpdate([...selected], bulkStatus); setSelected(new Set()) }
    finally { setDoing(false) }
  }, [onBulkUpdate, selected, bulkStatus])

  const totalPages = Math.ceil(total / limit)
  const now = Date.now()

  return (
    <div className="space-y-3">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select onValueChange={v => onFilterChange?.({ status: v === 'all' ? undefined : v })}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {QUERY_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        {courses && (
          <Select onValueChange={v => onFilterChange?.({ course_id: v === 'all' ? undefined : v })}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="All courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} – {c.section}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {selected.size > 0 && onBulkUpdate && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            <Select value={bulkStatus} onValueChange={v => setBulkStatus(v as QueryStatus)}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUERY_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={handleBulk} disabled={doing} className="h-8 text-xs">
              {doing ? 'Updating…' : 'Apply'}
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {onBulkUpdate && (
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === queries.length && queries.length > 0}
                    onChange={e => toggleAll(e.target.checked)}
                    className="rounded"
                  />
                </th>
              )}
              <th className="p-3 text-left font-medium text-muted-foreground">Reference</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Student</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Type</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="p-3 text-left font-medium text-muted-foreground">SLA Due</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {queries.length === 0 ? (
              <tr>
                <td colSpan={onBulkUpdate ? 7 : 6} className="p-8 text-center text-muted-foreground">
                  No queries found
                </td>
              </tr>
            ) : queries.map(q => {
              const slaBreach = q.sla_due_at &&
                new Date(q.sla_due_at).getTime() < now &&
                q.status !== 'resolved' && q.status !== 'rejected'

              return (
                <tr
                  key={q.id}
                  className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => onRowClick(q)}
                >
                  {onBulkUpdate && (
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(q.id)}
                        onChange={e => toggleOne(q.id, e.target.checked)}
                        className="rounded"
                      />
                    </td>
                  )}
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      {q.is_urgent && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                      <span className="font-mono text-xs">{q.reference_id}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div>
                      <p className="font-medium">{q.student_name}</p>
                      <p className="text-xs text-muted-foreground">{q.roll_number}</p>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{QUERY_TYPE_LABELS[q.query_type]}</td>
                  <td className="p-3"><StatusBadge status={q.status} /></td>
                  <td className="p-3">
                    {q.sla_due_at ? (
                      <span className={slaBreach ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                        {new Date(q.sla_due_at).toLocaleDateString()}
                        {slaBreach && ' ⚠'}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {new Date(q.submitted_at).toLocaleDateString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
