import { z } from 'zod'
import {
  FAST_EMAIL_RE, ROLL_NUMBER_RE,
  QUERY_TYPES, QUERY_STATUSES,
  DESCRIPTION_MIN_LENGTH, DESCRIPTION_MAX_LENGTH,
  ALLOWED_ATTACHMENT_MIMES, MAX_ATTACHMENT_MB,
} from '@/lib/constants'

// ── Student submit form ───────────────────────────────────────────
export const submitQuerySchema = z.object({
  course_id:      z.string().uuid('Invalid course'),
  query_type:     z.enum(QUERY_TYPES),
  session_number: z.string().max(100).optional(),
  session_date:   z.string().optional(),
  description:    z.string()
    .min(DESCRIPTION_MIN_LENGTH, `Minimum ${DESCRIPTION_MIN_LENGTH} characters`)
    .max(DESCRIPTION_MAX_LENGTH, `Maximum ${DESCRIPTION_MAX_LENGTH} characters`),
  extra_date:     z.string().optional(),
  marks_awarded:  z.coerce.number().min(0).max(1000).optional(),
  marks_expected: z.coerce.number().min(0).max(1000).optional(),
  issue_reason:   z.string().max(500).optional(),
  request_type:   z.string().max(100).optional(),
  is_urgent:      z.boolean().default(false),
})

export type SubmitQueryFormValues = z.infer<typeof submitQuerySchema>

// ── Status update ─────────────────────────────────────────────────
export const updateStatusSchema = z.object({
  query_id:         z.string().uuid(),
  status:           z.enum(QUERY_STATUSES),
  instructor_notes: z.string().max(1000).optional(),
})

export type UpdateStatusFormValues = z.infer<typeof updateStatusSchema>

// ── Bulk update ───────────────────────────────────────────────────
export const bulkUpdateSchema = z.object({
  query_ids: z.array(z.string().uuid()).min(1, 'Select at least one query'),
  status:    z.enum(QUERY_STATUSES),
  notes:     z.string().max(1000).optional(),
})

export type BulkUpdateFormValues = z.infer<typeof bulkUpdateSchema>

// ── Course settings ───────────────────────────────────────────────
export const courseSettingsSchema = z.object({
  name:                 z.string().min(3).max(200),
  code:                 z.string().min(2).max(20),
  term:                 z.string().min(3).max(50),
  section:              z.string().min(1).max(50),
  session_count:        z.coerce.number().int().min(1).max(50).default(14),
  session_label:        z.enum(['Lab', 'Lecture']).default('Lab'),
  is_lab:               z.boolean().default(true),
  query_window_days:    z.coerce.number().int().min(1).max(30).default(7),
  max_attachment_mb:    z.coerce.number().int().min(1).max(20).default(5),
  sla_response_hours:   z.coerce.number().int().min(1).max(168).default(48),
  enabled_query_types:  z.record(z.enum(QUERY_TYPES), z.boolean()),
})

export type CourseSettingsFormValues = z.infer<typeof courseSettingsSchema>

// ── Roll number / email helpers ───────────────────────────────────
export const rollNumberSchema = z
  .string()
  .regex(ROLL_NUMBER_RE, 'Format: 23I-1234')

export const fastEmailSchema = z
  .string()
  .regex(FAST_EMAIL_RE, 'Must be a @nu.edu.pk or @isb.nu.edu.pk address')

// ── Attachment ────────────────────────────────────────────────────
export function validateAttachment(file: File): string | null {
  if (!ALLOWED_ATTACHMENT_MIMES.includes(file.type)) {
    return `File type not allowed. Use: PDF, image, Word, or plain text.`
  }
  if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
    return `File must be under ${MAX_ATTACHMENT_MB} MB.`
  }
  return null
}
