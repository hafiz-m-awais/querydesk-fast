// ── FAST-NUCES specific constants ─────────────────────────────────

export const CAMPUS_CODES = ['ISB', 'LHR', 'KHI', 'PEW', 'CFD'] as const
export type CampusCode = typeof CAMPUS_CODES[number]

export const CAMPUS_NAMES: Record<CampusCode, string> = {
  ISB: 'Islamabad',
  LHR: 'Lahore',
  KHI: 'Karachi',
  PEW: 'Peshawar',
  CFD: 'Chiniot-Faisalabad',
}

export const DEPT_CODES = ['CS', 'SE', 'EE', 'BSBA', 'MBA', 'DS', 'AI', 'ENG', 'MS'] as const
export type DeptCode = typeof DEPT_CODES[number]

// FAST-NUCES email domains (all campuses share nu.edu.pk)
export const ALLOWED_EMAIL_DOMAINS = ['nu.edu.pk', 'isb.nu.edu.pk', 'gmail.com']

// Roll number: 23I-1234 / 23K-1234 / 22L-5678
export const ROLL_NUMBER_RE = /^\d{2}[A-Z]-\d{4}$/i

// Email validation for FAST-NUCES
export const FAST_EMAIL_RE = /^[^\s@]+@(isb\.)?nu\.edu\.pk$/i

export const USER_ROLES = ['student', 'ta', 'instructor', 'coordinator', 'hod', 'superadmin'] as const
export type UserRole = typeof USER_ROLES[number]

export const ROLE_LABELS: Record<UserRole, string> = {
  student:     'Student',
  ta:          'Teaching Assistant',
  instructor:  'Instructor',
  coordinator: 'Course Coordinator',
  hod:         'Head of Department',
  superadmin:  'System Admin',
}

export const QUERY_TYPES = ['attendance', 'marks', 'assignment', 'project', 'final', 'other'] as const
export type QueryType = typeof QUERY_TYPES[number]

export const QUERY_TYPE_LABELS: Record<QueryType, string> = {
  attendance:  'Attendance',
  marks:       'Marks / Grade',
  assignment:  'Assignment',
  project:     'Project',
  final:       'Final Exam',
  other:       'Other',
}

export const QUERY_STATUSES = ['pending', 'reviewing', 'resolved', 'rejected', 'escalated'] as const
export type QueryStatus = typeof QUERY_STATUSES[number]

export const STATUS_LABELS: Record<QueryStatus, string> = {
  pending:    'Pending',
  reviewing:  'Reviewing',
  resolved:   'Resolved',
  rejected:   'Rejected',
  escalated:  'Escalated',
}

export const STATUS_COLORS: Record<QueryStatus, string> = {
  pending:   'bg-yellow-100 text-yellow-800',
  reviewing: 'bg-blue-100   text-blue-800',
  resolved:  'bg-green-100  text-green-800',
  rejected:  'bg-red-100    text-red-800',
  escalated: 'bg-purple-100 text-purple-800',
}

export const ALLOWED_ATTACHMENT_MIMES = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

export const MAX_ATTACHMENT_MB = 5
export const MAX_SUBMISSIONS_PER_HOUR = 5
export const DESCRIPTION_MIN_LENGTH = 10
export const DESCRIPTION_MAX_LENGTH = 2000

export const APP_NAME   = process.env.NEXT_PUBLIC_APP_NAME   || 'QueryDesk'
export const APP_URL    = process.env.NEXT_PUBLIC_APP_URL    || 'http://localhost:3000'
export const INSTITUTION = process.env.NEXT_PUBLIC_INSTITUTION || 'FAST-NUCES'
