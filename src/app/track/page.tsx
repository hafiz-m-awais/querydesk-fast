'use client'

import { useState } from 'react'
import { ROLL_NUMBER_RE, STATUS_LABELS, STATUS_COLORS, QUERY_TYPE_LABELS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { APP_NAME } from '@/lib/constants'
import type { QueryStatus, QueryType } from '@/lib/constants'

interface TrackRow {
  reference_id:  string
  query_type:    QueryType
  status:        QueryStatus
  is_urgent:     boolean
  submitted_at:  string
  resolved_at:   string | null
  sla_due_at:    string | null
  course:        { name: string; section: string } | null
  instructor_notes: string | null
}

export default function TrackPage() {
  const [roll, setRoll]       = useState('')
  const [results, setResults] = useState<TrackRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const valid = ROLL_NUMBER_RE.test(roll.trim())

  async function search() {
    if (!valid) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/track?roll=${encodeURIComponent(roll.trim())}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Lookup failed')
      setResults(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background px-4 py-3">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <span className="text-lg font-bold text-primary">{APP_NAME}</span>
          <a href="/login" className="text-sm text-muted-foreground hover:text-foreground">Login</a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Track Your Query</h1>
          <p className="text-muted-foreground">Enter your roll number to see all your submitted queries</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="roll">Roll Number</Label>
                <Input
                  id="roll"
                  value={roll}
                  onChange={e => { setRoll(e.target.value); setResults(null) }}
                  placeholder="23I-1234"
                  onKeyDown={e => e.key === 'Enter' && search()}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={search} disabled={!valid || loading}>
                  {loading ? 'Searching…' : 'Search'}
                </Button>
              </div>
            </div>
            {!valid && roll.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Format: 23I-1234</p>
            )}
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive text-center">{error}</p>}

        {results !== null && (
          results.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No queries found for this roll number.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{results.length} quer{results.length === 1 ? 'y' : 'ies'} found</p>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium text-muted-foreground">Reference</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Course</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Type</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Status</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.reference_id} className="border-b last:border-0">
                        <td className="p-3 font-mono text-xs">{r.reference_id}</td>
                        <td className="p-3">
                          {r.course ? `${r.course.name} (${r.course.section})` : '—'}
                        </td>
                        <td className="p-3 text-muted-foreground">{QUERY_TYPE_LABELS[r.query_type]}</td>
                        <td className="p-3">
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                            STATUS_COLORS[r.status],
                          )}>
                            {STATUS_LABELS[r.status]}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {new Date(r.submitted_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {results.some(r => r.instructor_notes) && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Instructor Notes</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {results.filter(r => r.instructor_notes).map(r => (
                      <div key={r.reference_id} className="text-sm">
                        <span className="font-mono text-xs text-muted-foreground">{r.reference_id}:</span>
                        <p className="mt-0.5 text-foreground">{r.instructor_notes}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )
        )}
      </main>
    </div>
  )
}
