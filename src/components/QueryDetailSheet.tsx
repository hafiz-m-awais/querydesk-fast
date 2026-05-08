'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { QUERY_STATUSES, STATUS_LABELS, STATUS_COLORS } from '@/lib/constants'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import StatusBadge from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import type { Query, QueryHistory, QueryStatus } from '@/types'
import { QUERY_TYPE_LABELS } from '@/lib/constants'

const updateSchema = z.object({
  status:           z.enum(QUERY_STATUSES),
  instructor_notes: z.string().max(1000).optional(),
})

interface QueryDetailSheetProps {
  query:    Query | null
  open:     boolean
  onClose:  () => void
  onUpdate: (id: string, status: QueryStatus, notes?: string) => Promise<void>
}

export default function QueryDetailSheet({ query, open, onClose, onUpdate }: QueryDetailSheetProps) {
  const [saving, setSaving]   = useState(false)
  const [history, setHistory] = useState<(QueryHistory & { actor?: { full_name: string | null; role: string } | null })[]>([])

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(updateSchema),
    values: { status: query?.status ?? 'pending', instructor_notes: query?.instructor_notes ?? '' },
  })

  // Fetch full detail with history whenever a query is opened
  useEffect(() => {
    if (!query?.id || !open) return
    let mounted = true
    fetch(`/api/queries/${query.id}`)
      .then(r => r.json())
      .then(json => { if (mounted) setHistory(json.data?.history ?? []) })
      .catch(() => {})
    return () => { mounted = false }
  }, [query?.id, open])

  // Reset form and history when sheet closes
  useEffect(() => {
    if (!open) { reset(); setHistory([]) }
  }, [open, reset])

  if (!query) return null

  const onSubmit = handleSubmit(async ({ status, instructor_notes }) => {
    setSaving(true)
    try {
      await onUpdate(query.id, status as QueryStatus, instructor_notes)
      onClose()
    } finally {
      setSaving(false)
    }
  })

  const rows: [string, React.ReactNode][] = [
    ['Reference',    <span key="ref" className="font-mono text-sm">{query.reference_id}</span>],
    ['Student',      `${query.student_name} (${query.roll_number})`],
    ['Course',       (query.course as { name?: string })?.name ?? '—'],
    ['Section',      query.section],
    ['Type',         QUERY_TYPE_LABELS[query.query_type]],
    ['Session',      query.session_number ?? '—'],
    ['Status',       <StatusBadge key="status" status={query.status} />],
    ['Submitted',    new Date(query.submitted_at).toLocaleString()],
    ...(query.sla_due_at ? [['SLA Due', new Date(query.sla_due_at).toLocaleString()] as [string, React.ReactNode]] : []),
    ['Description',  query.description],
    ...(query.marks_awarded != null ? [['Marks Awarded', String(query.marks_awarded)] as [string, React.ReactNode]] : []),
    ...(query.marks_expected != null ? [['Marks Expected', String(query.marks_expected)] as [string, React.ReactNode]] : []),
    ...(query.issue_reason ? [['Issue Reason', query.issue_reason] as [string, React.ReactNode]] : []),
    // Only render attachment link when BOTH name and path are present
    ...(query.attachment_name && query.attachment_path ? [['Attachment', (
      <a
        key="att"
        href={`/api/attachment/${query.attachment_path}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline text-sm"
      >
        {query.attachment_name}
      </a>
    )] as [string, React.ReactNode]] : []),
  ]

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Query Detail</SheetTitle>
          <SheetDescription>{query.reference_id}</SheetDescription>
        </SheetHeader>

        {/* Detail rows */}
        <div className="space-y-1 text-sm mb-6">
          {rows.map(([label, value]) => (
            <div key={label as string} className="grid grid-cols-[140px_1fr] gap-2 py-1.5 border-b last:border-0">
              <span className="text-muted-foreground font-medium">{label}</span>
              <span className="break-words">{value}</span>
            </div>
          ))}
        </div>

        {/* History timeline */}
        {history.length > 0 && (
          <>
            <Separator className="mb-4" />
            <h3 className="text-sm font-semibold mb-3">Activity History</h3>
            <ol className="space-y-3 mb-6">
              {history.map((h, i) => (
                <li key={h.id} className="flex gap-3 text-sm">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'h-2.5 w-2.5 rounded-full mt-1 shrink-0',
                      h.new_status ? STATUS_COLORS[h.new_status].split(' ')[0] : 'bg-muted-foreground'
                    )} />
                    {i < history.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium capitalize">{h.action.replace(/_/g, ' ')}</span>
                      {h.new_status && <StatusBadge status={h.new_status} />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {h.actor?.full_name ?? 'System'} · {new Date(h.created_at).toLocaleString()}
                    </p>
                    {h.note && <p className="text-xs mt-0.5 text-foreground/80 italic">{h.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}

        {/* Status update form */}
        <form onSubmit={onSubmit} className="space-y-4 border-t pt-4">
          <div className="space-y-1.5">
            <Label>Update Status</Label>
            <Select
              defaultValue={query.status}
              onValueChange={v => setValue('status', v as QueryStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUERY_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              {...register('instructor_notes')}
              placeholder="Add a note for the student…"
              className="resize-none"
              rows={3}
            />
            {errors.instructor_notes && <p className="text-xs text-destructive">{errors.instructor_notes.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Saving…' : 'Update Query'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
