'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { QUERY_TYPES, QUERY_TYPE_LABELS, DESCRIPTION_MIN_LENGTH, DESCRIPTION_MAX_LENGTH } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AttachmentUpload from '@/components/AttachmentUpload'
import type { Course, AttachmentPayload } from '@/types'
import type { QueryType } from '@/lib/constants'

// Per-type required field validation
const schema = z.object({
  course_id:      z.string().uuid('Select a course'),
  query_type:     z.enum(QUERY_TYPES, { required_error: 'Select a query type' }),
  description:    z.string()
    .min(DESCRIPTION_MIN_LENGTH, `Minimum ${DESCRIPTION_MIN_LENGTH} characters`)
    .max(DESCRIPTION_MAX_LENGTH, `Maximum ${DESCRIPTION_MAX_LENGTH} characters`),
  session_number: z.string().max(100).optional(),
  session_date:   z.string().optional(),
  marks_awarded:  z.coerce.number().min(0).max(1000).optional(),
  marks_expected: z.coerce.number().min(0).max(1000).optional(),
  issue_reason:   z.string().max(500).optional(),
  request_type:   z.string().max(200).optional(),
  is_urgent:      z.boolean().default(false),
}).superRefine((val, ctx) => {
  if (val.query_type === 'attendance' && !val.session_number?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['session_number'], message: 'Session number is required for attendance queries' })
  }
  if ((val.query_type === 'marks' || val.query_type === 'final') && val.marks_awarded == null) {
    ctx.addIssue({ code: 'custom', path: ['marks_awarded'], message: 'Marks awarded is required' })
  }
  if ((val.query_type === 'marks' || val.query_type === 'final') && val.marks_expected == null) {
    ctx.addIssue({ code: 'custom', path: ['marks_expected'], message: 'Marks expected is required' })
  }
})

type FormValues = z.infer<typeof schema>

const TYPE_SPECIFIC_FIELDS = {
  attendance:  ['session_number', 'session_date'] as const,
  marks:       ['marks_awarded', 'marks_expected', 'issue_reason'] as const,
  final:       ['marks_awarded', 'marks_expected'] as const,
  assignment:  ['session_number', 'request_type'] as const,
  project:     ['session_number', 'request_type'] as const,
  other:       [] as const,
}

interface SubmitFormProps {
  courses: Course[]
}

export default function SubmitForm({ courses }: SubmitFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [referenceId, setReferenceId] = useState<string | null>(null)
  const [attachment, setAttachment] = useState<AttachmentPayload | null>(null)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { is_urgent: false },
  })

  const selectedCourseId = watch('course_id')
  const selectedType     = watch('query_type') as QueryType | undefined
  const description      = watch('description') ?? ''
  const selectedCourse   = courses.find(c => c.id === selectedCourseId)

  // Filter available types for selected course
  const availableTypes = QUERY_TYPES.filter(t =>
    !selectedCourse || selectedCourse.enabled_query_types[t] !== false
  )

  // When course changes: reset type and all type-specific fields
  useEffect(() => {
    setValue('query_type', undefined as unknown as QueryType, { shouldValidate: false })
    setValue('session_number', '')
    setValue('session_date', '')
    setValue('marks_awarded', undefined)
    setValue('marks_expected', undefined)
    setValue('issue_reason', '')
    setValue('request_type', '')
  }, [selectedCourseId, setValue])

  // When type changes: clear fields that belong to other types
  useEffect(() => {
    if (!selectedType) return
    const keep = new Set<string>(TYPE_SPECIFIC_FIELDS[selectedType])
    const allFields: (keyof FormValues)[] = ['session_number', 'session_date', 'marks_awarded', 'marks_expected', 'issue_reason', 'request_type']
    for (const field of allFields) {
      if (!keep.has(field)) {
        setValue(field as keyof FormValues, field === 'marks_awarded' || field === 'marks_expected' ? undefined : '')
      }
    }
  }, [selectedType, setValue])

  const onSubmit = handleSubmit(async (data) => {
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { ...data }
      if (attachment) body.attachment = attachment

      const res = await fetch('/api/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Submission failed')
      setReferenceId(json.data?.reference_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  })

  if (referenceId) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-6 text-center space-y-3">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-semibold">Query Submitted!</h2>
          <p className="text-muted-foreground">Your reference ID is:</p>
          <p className="font-mono text-2xl font-bold text-primary">{referenceId}</p>
          <p className="text-sm text-muted-foreground">You&apos;ll receive an email confirmation shortly.</p>
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" onClick={() => { setReferenceId(null); reset(); setAttachment(null); setError(null) }}>
              Submit another
            </Button>
            <Button onClick={() => router.push('/')}>Done</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Submit a Query</CardTitle>
      </CardHeader>
      <CardContent>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No active courses found for your department. Contact your coordinator.
          </p>
        ) : (
        <form onSubmit={onSubmit} className="space-y-5">

          {/* Course */}
          <div className="space-y-1.5">
            <Label>Course</Label>
            <Select onValueChange={v => setValue('course_id', v, { shouldValidate: true })}>
              <SelectTrigger>
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} – {c.name} ({c.section})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.course_id && <p className="text-xs text-destructive">{errors.course_id.message}</p>}
          </div>

          {/* Type — key forces remount/visual reset when course changes */}
          <div className="space-y-1.5">
            <Label>Query Type</Label>
            <Select
              key={selectedCourseId ?? 'no-course'}
              disabled={!selectedCourseId}
              onValueChange={v => setValue('query_type', v as QueryType, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectedCourseId ? 'Select type' : 'Select course first'} />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map(t => (
                  <SelectItem key={t} value={t}>{QUERY_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.query_type && <p className="text-xs text-destructive">{errors.query_type.message}</p>}
          </div>

          {/* Type-specific fields */}
          {selectedType === 'attendance' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Session Number <span className="text-destructive">*</span></Label>
                <Input {...register('session_number')} placeholder="e.g. 5" />
                {errors.session_number && <p className="text-xs text-destructive">{errors.session_number.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Session Date</Label>
                <Input type="date" max={new Date().toISOString().split('T')[0]} {...register('session_date')} />
              </div>
            </div>
          )}

          {(selectedType === 'marks' || selectedType === 'final') && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Marks Awarded <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.5" min="0" {...register('marks_awarded')} placeholder="0" />
                {errors.marks_awarded && <p className="text-xs text-destructive">{errors.marks_awarded.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Marks Expected <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.5" min="0" {...register('marks_expected')} placeholder="10" />
                {errors.marks_expected && <p className="text-xs text-destructive">{errors.marks_expected.message}</p>}
              </div>
              {selectedType === 'marks' && (
                <div className="col-span-2 space-y-1.5">
                  <Label>Issue Reason</Label>
                  <Input {...register('issue_reason')} placeholder="Briefly describe the marking issue" />
                </div>
              )}
            </div>
          )}

          {(selectedType === 'assignment' || selectedType === 'project') && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Session / Submission Number</Label>
                <Input {...register('session_number')} placeholder="e.g. 3" />
              </div>
              <div className="space-y-1.5">
                <Label>Request Type</Label>
                <Input {...register('request_type')} placeholder="e.g. Recheck, Extension" />
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Description</Label>
              <span className={`text-xs ${description.length > DESCRIPTION_MAX_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
                {description.length} / {DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              {...register('description')}
              placeholder="Describe your query in detail…"
              rows={4}
              className="resize-none"
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          {/* Attachment */}
          <div className="space-y-1.5">
            <Label>Attachment (optional)</Label>
            <AttachmentUpload value={attachment} onChange={setAttachment} />
          </div>

          {/* Urgent */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('is_urgent')} className="rounded" />
            <span className="text-sm font-medium">Mark as urgent</span>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={saving || !selectedType}>
            {saving ? 'Submitting…' : 'Submit Query'}
          </Button>
        </form>
        )}
      </CardContent>
    </Card>
  )
}
