import type { QueryStatus, QueryType, UserRole, CampusCode } from '@/lib/constants'
export type { QueryStatus, QueryType, UserRole, CampusCode }

// ── Database row types (mirror Supabase schema) ───────────────────

export interface Campus {
  id:        string
  code:      CampusCode
  name:      string
  city:      string
  is_active: boolean
}

export interface Department {
  id:          string
  campus_id:   string
  code:        string
  name:        string
  is_active:   boolean
  campus?:     Campus
}

export interface Profile {
  id:            string
  email:         string
  full_name:     string | null
  roll_number:   string | null
  role:          UserRole
  campus_id:     string | null
  department_id: string | null
  batch_year:    number | null
  avatar_url:    string | null
  is_active:     boolean
  created_at:    string
  campus?:       Campus
  department?:   Department
}

export interface Course {
  id:                   string
  department_id:        string
  code:                 string
  name:                 string
  term:                 string
  section:              string
  instructor_id:        string | null
  session_count:        number
  session_label:        string
  is_lab:               boolean
  query_window_days:    number
  max_attachment_mb:    number
  enabled_query_types:  Record<QueryType, boolean>
  sla_response_hours:   number
  is_active:            boolean
  created_at:           string
  department?:          Department
  instructor?:          Profile
}

export interface Query {
  id:               string
  reference_id:     string
  course_id:        string | null
  student_id:       string | null
  student_email:    string
  student_name:     string
  roll_number:      string
  section:          string
  query_type:       QueryType
  session_number:   string | null
  session_date:     string | null
  description:      string
  extra_date:       string | null
  marks_awarded:    number | null
  marks_expected:   number | null
  issue_reason:     string | null
  request_type:     string | null
  is_urgent:        boolean
  status:           QueryStatus
  instructor_notes: string | null
  resolved_by:      string | null
  resolved_at:      string | null
  escalated_at:     string | null
  escalated_to:     string | null
  attachment_path:  string | null
  attachment_name:  string | null
  attachment_mime:  string | null
  sla_due_at:       string | null
  submitted_at:     string
  updated_at:       string
  course?:          Course
  student?:         Profile
}

export interface QueryHistory {
  id:         string
  query_id:   string
  actor_id:   string | null
  action:     string
  old_status: QueryStatus | null
  new_status: QueryStatus | null
  note:       string | null
  created_at: string
  actor?:     Profile
}

export interface Notification {
  id:           string
  recipient_id: string
  query_id:     string
  title:        string
  message:      string
  is_read:      boolean
  created_at:   string
}

// ── API request / response types ─────────────────────────────────

export interface SubmitQueryPayload {
  course_id:       string
  query_type:      QueryType
  session_number?: string
  session_date?:   string
  description:     string
  extra_date?:     string
  marks_awarded?:  number
  marks_expected?: number
  issue_reason?:   string
  request_type?:   string
  is_urgent:       boolean
  attachment?:     AttachmentPayload
}

export interface AttachmentPayload {
  name: string
  mime: string
  data: string   // base64
  size: number   // bytes
}

export interface UpdateStatusPayload {
  query_id:         string
  status:           QueryStatus
  instructor_notes?: string
}

export interface BulkUpdatePayload {
  query_ids: string[]
  status:    QueryStatus
  notes?:    string
}

export interface StatsResponse {
  total:       number
  pending:     number
  reviewing:   number
  resolved:    number
  rejected:    number
  escalated:   number
  urgent:      number
  sla_breached: number
  by_type:     Record<string, number>
  by_section:  Record<string, number>
  by_course:   Record<string, number>
  avg_resolution_hours: number
}

export interface ApiResponse<T = unknown> {
  data?:    T
  error?:   string
  message?: string
}
