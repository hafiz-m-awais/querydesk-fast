# QueryDesk — FAST-NUCES

A full-stack student query management system built exclusively for FAST-NUCES. Students submit academic queries (attendance, marks, assignments, etc.) through a web portal. Instructors review, respond, and close them. HoDs get escalation alerts when SLA is breached.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript strict) |
| Database | Supabase (PostgreSQL 15 + Row Level Security) |
| Auth | Supabase Auth → Google OAuth (restricted to `@nu.edu.pk`) |
| File Storage | Supabase Storage (`query-attachments` private bucket) |
| Email | Resend (transactional HTML emails) |
| UI | Tailwind CSS + shadcn/ui + Radix UI primitives |
| Forms | React Hook Form + Zod (shared client/server schemas) |
| Hosting | Vercel (zero-config, auto CI/CD from GitHub) |

---

## Project Structure

```
querydesk-fast/
├── supabase/
│   └── schema.sql              # Full DB schema — run once in Supabase SQL Editor
├── src/
│   ├── middleware.ts            # Auth guard + domain enforcement + role routing
│   ├── types/
│   │   └── index.ts             # TypeScript interfaces (Campus, Profile, Query, ...)
│   ├── lib/
│   │   ├── constants.ts         # FAST-NUCES constants (campuses, roles, regex, limits)
│   │   ├── validations.ts       # Zod schemas (submit, updateStatus, bulkUpdate, ...)
│   │   ├── email.ts             # All Resend email templates
│   │   └── supabase/
│   │       ├── client.ts        # Browser client (Client Components)
│   │       └── server.ts        # Server client + admin client (Route Handlers / SC)
│   ├── components/
│   │   └── LoginButton.tsx      # Google OAuth sign-in button
│   └── app/
│       ├── layout.tsx           # Root layout (Inter font, metadata)
│       ├── globals.css          # Tailwind + FAST green CSS variables
│       ├── page.tsx             # Root redirect by role
│       ├── login/page.tsx       # Login page (FAST branding)
│       ├── auth/callback/
│       │   └── route.ts         # OAuth callback handler
│       └── api/
│           ├── queries/
│           │   ├── route.ts     # GET (list) + POST (submit)
│           │   ├── [id]/route.ts # PATCH (update status) + DELETE
│           │   └── bulk/route.ts # Bulk status update
│           └── stats/
│               └── route.ts     # Dashboard analytics
```

---

## Database Schema

### Tables

| Table | Purpose |
|---|---|
| `campuses` | 5 FAST-NUCES campuses (ISB, LHR, KHI, PEW, CFD) |
| `departments` | Departments per campus (CS, SE, EE, BSBA, DS, AI, ...) |
| `profiles` | Extends `auth.users` — roll number, role, campus, department |
| `courses` | Each section of a course with instructor, SLA hours, settings |
| `course_tas` | Teaching assistants assigned to courses |
| `queries` | Student queries (main data table) |
| `query_history` | Audit log — every status change with actor + timestamp |
| `notifications` | In-app notifications for students/staff |
| `sla_rules` | Per-department SLA defaults |

### Enums

- `user_role`: `student | ta | instructor | coordinator | hod | superadmin`
- `query_status`: `pending | reviewing | resolved | rejected | escalated`
- `query_type`: `attendance | marks | assignment | project | final | other`
- `campus_code`: `ISB | LHR | KHI | PEW | CFD`

### Auto Triggers

- `update_updated_at` — keeps `updated_at` current on any row change
- `generate_reference_id` — auto-generates readable ID like `QD-ABCD1234-2605`
- `set_sla_due_at` — auto-sets `sla_due_at` from `course.sla_response_hours` on insert
- `handle_new_user` — creates `profiles` row on first Google OAuth sign-in

### Row Level Security (RLS)

| Actor | What they can see |
|---|---|
| Student | Own queries only |
| TA | Queries for their assigned courses |
| Instructor | All queries for their courses |
| Coordinator | All queries in their department |
| HoD | All queries in their department |
| Superadmin | Everything |

---

## Authentication Flow

```
Student visits site
  → middleware checks session
  → no session → redirect /login
  → login page → click "Sign in with Google"
  → Google OAuth → restrict domain hd=nu.edu.pk
  → /auth/callback → exchangeCodeForSession → redirect /
  → root page.tsx → fetch profile role → redirect /submit (student) or /instructor/dashboard (staff)
```

- Domain enforcement runs in **both** middleware (server-side) and OAuth hint (`hd: 'nu.edu.pk'`)
- Non-FAST emails are signed out immediately and redirected to `/login?error=domain_not_allowed`
- New users get a profile row automatically via the `handle_new_user` DB trigger

---

## API Endpoints

### `POST /api/queries` — Submit a query
- Auth: must be a `student` role
- Rate limit: max 5 submissions per hour (counted server-side in Supabase)
- Duplicate guard: same type + session + course within 24h is blocked (409)
- Attachment: base64 upload to Supabase Storage, validated mime + size before decode
- On success: emails student (confirmation) + instructor (alert), creates audit log row
- Returns: `{ reference_id: "QD-ABCD1234-2605" }`

### `GET /api/queries` — List queries
- Auth: any authenticated user (RLS limits what they see)
- Query params: `course_id`, `status`, `page`, `limit` (max 100)
- Returns paginated results with course + student joins

### `PATCH /api/queries/[id]` — Update status
- Auth: `ta | instructor | coordinator | hod | superadmin`
- Body: `{ status, instructor_notes? }`
- Sets `resolved_at` + `resolved_by` when resolved/rejected
- Sets `escalated_at` when escalated
- Sends HoD escalation email when `status = escalated`
- Creates audit log + in-app notification for student

### `DELETE /api/queries/[id]` — Hard delete
- Auth: `hod | superadmin` only
- Also logs deletion to `query_history`

### `POST /api/queries/bulk` — Bulk update
- Auth: `instructor | coordinator | hod | superadmin`
- Body: `{ query_ids: string[], status, notes? }`
- Updates all, creates audit log, sends emails for resolved/rejected

### `GET /api/stats` — Dashboard analytics
- Auth: any staff (not students)
- Query params: `course_id` (optional filter)
- Returns: total, pending, reviewing, resolved, rejected, escalated, urgent, sla_breached, by_type, by_section, by_course, avg_resolution_hours

---

## Email System (Resend)

| Email | Trigger | Recipient |
|---|---|---|
| Submit Confirmation | Student submits query | Student |
| Instructor Alert | Student submits query | Instructor of course |
| Status Notification | Query resolved / rejected | Student |
| Escalation Alert | Status changed to `escalated` | HoD of department |

All emails use FAST-NUCES branding (green theme) and pull `institution` + `siteUrl` from course settings — no hardcoded URLs.

---

## FAST-NUCES Domain Rules

- **Email domains**: `@nu.edu.pk`, `@isb.nu.edu.pk`
- **Roll number format**: `23I-1234` (2-digit year + campus letter + 4 digits), e.g. `23I-1234`, `22K-5678`
- **Campuses**: ISB (Islamabad), LHR (Lahore), KHI (Karachi), PEW (Peshawar), CFD (Chiniot-Faisalabad)
- **Departments**: CS, SE, EE, BSBA, MBA, DS, AI, ENG, MS

---

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...         # server-only, bypasses RLS for storage

RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com

NEXT_PUBLIC_APP_URL=https://querydesk.nu.edu.pk
NEXT_PUBLIC_APP_NAME=QueryDesk
NEXT_PUBLIC_INSTITUTION=FAST-NUCES
```

> **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the client. It is only used in `createAdminClient()` in server-side code.

---

## Local Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill environment variables
copy .env.local.example .env.local

# 3. Set up Supabase
#    - Create project at https://supabase.com
#    - Paste supabase/schema.sql into SQL Editor and run
#    - Enable Google OAuth: Auth → Providers → Google
#      Set "Allowed email domains" hd restriction to nu.edu.pk
#    - Create storage bucket: Storage → New bucket
#      Name: query-attachments | Private | Max file size: 5MB
#    - Copy URL + anon key + service role key into .env.local

# 4. Set up Resend
#    - Create account at https://resend.com
#    - Add and verify your sending domain
#    - Create API key → paste into RESEND_API_KEY

# 5. Start dev server
npm run dev
# → http://localhost:3000

# 6. Type check
npm run type-check
```

---

## Deployment (Vercel)

```bash
# Option A — Vercel CLI (first time)
npx vercel

# Option B — GitHub integration (recommended)
# 1. Push to GitHub
# 2. Connect repo at https://vercel.com/new
# 3. Add all env variables from .env.local in Vercel dashboard
# 4. Every push to main auto-deploys
```

### Vercel Environment Variables to Set
Add all variables from `.env.local` in the Vercel project settings under Environment Variables. Set `NEXT_PUBLIC_APP_URL` to your production domain.

### Custom Domain
1. Vercel Dashboard → Domains → Add `querydesk.nu.edu.pk`
2. Add CNAME record at your DNS provider pointing to Vercel
3. Update `NEXT_PUBLIC_APP_URL` in Vercel env vars

---

## What Is NOT Built Yet (TODO)

### UI Pages

| Page | Path | Description |
|---|---|---|
| Student Submit Form | `/submit` | Query submission form with dynamic fields by type |
| Student Track Page | `/track` | Public page — enter roll number → view query status |
| Instructor Dashboard | `/instructor/dashboard` | Query list table with filter/sort/bulk actions |
| Course Settings | `/instructor/settings` | SLA hours, query types on/off, session count |
| HoD Overview | `/hod/dashboard` | Department-wide stats + SLA breach list |
| Profile Setup | `/profile` | New user completes roll number + department + batch |

### Shared Components

| Component | Purpose |
|---|---|
| `QueryTable` | Sortable/filterable data table with bulk select |
| `StatsCards` | Total, pending, resolved, SLA breached counters |
| `StatusBadge` | Colored pill for query status |
| `QueryForm` | Multi-step form with conditional fields per query type |
| `QueryDetailSheet` | Slide-over panel with full query detail + update form |
| `NotificationBell` | Real-time in-app notification badge |
| `AttachmentUpload` | Drag-drop file upload with mime + size validation |

### Backend Features

| Feature | Notes |
|---|---|
| SLA Escalation Cron | Supabase Edge Function or `pg_cron` — auto-escalate queries past `sla_due_at` |
| Secure Attachment Download | Signed URL endpoint `/api/attachment/[path]` — generate short-lived Supabase signed URLs |
| Profile Completion Guard | Middleware redirect to `/profile` if `roll_number` is null |
| Course Enrollment API | `POST /api/courses/[id]/enroll` — student self-enroll with section code |
| Admin Course Management | CRUD for courses — create sections, assign instructors |
| `GET /api/queries/[id]` | Fetch single query with full history (currently missing) |
| Export to CSV | `GET /api/queries?export=csv` for instructor to download all queries |

---

## Improvement Ideas

### Security
- [ ] Add CSRF protection for form submissions
- [ ] Rate limit per IP (not just per user) using Vercel Edge middleware + KV store
- [ ] Audit log viewer in admin dashboard (currently writes to `query_history` but no UI)
- [ ] Session timeout — auto sign-out after 8 hours of inactivity

### UX
- [ ] Real-time query status updates via Supabase Realtime subscriptions (no page refresh needed)
- [ ] Mobile-first responsive layout (currently desktop-focused)
- [ ] Dark mode support using Tailwind `dark:` classes
- [ ] Query status timeline view (visual step indicator using `query_history` audit rows)
- [ ] PDF receipt generation for resolved queries (downloadable proof for students)

### Performance
- [ ] Cache frequently-read course list with SWR or React Query
- [ ] Infinite scroll / virtual list for large query tables (instructors with 1000+ queries)
- [ ] DB indexes on `queries(student_id)`, `queries(course_id, status)`, `queries(submitted_at)` — add to schema.sql

### Multi-Campus Scalability
- [ ] Campus admin role — manage departments and courses for a single campus
- [ ] Per-campus branding override (each campus can set their own colors/logo)
- [ ] Cross-campus query transfer (rare but possible when student changes campus)

### Analytics
- [ ] Weekly email digest to HoD — unresolved count, SLA breach rate
- [ ] Response time heatmap by day/hour (when are queries resolved fastest)
- [ ] Per-instructor performance metrics (avg resolution time, rejection rate)
- [ ] Student satisfaction rating after resolution (1–5 stars)

### Integration
- [ ] FAST LMS integration — pre-fill course list from FAST's existing systems
- [ ] Google Classroom course sync (for instructors who use it)
- [ ] WhatsApp notification via Twilio for urgent query alerts (common in Pakistan)
- [ ] Slack/Teams webhook for instructor notifications

---

## Known Limitations (Current Build)

1. **No UI pages built yet** — all backend logic is complete, frontend pages are the next milestone
2. **Profile completion not enforced** — if `roll_number` is null, queries will fail at the API; need `/profile` setup page and middleware redirect
3. **Attachment download is manual** — no signed URL endpoint yet; `attachment_path` is stored but no way to retrieve it
4. **No `GET /api/queries/[id]`** — single query detail fetch endpoint missing; needed for the detail panel
5. **SLA auto-escalation not automated** — `sla_due_at` is set on insert but no cron runs to auto-change status; instructors must manually escalate
6. **Google OAuth only** — no email+password fallback for staff who may not have Google accounts linked to their `@nu.edu.pk` email

---

## Data Flow Diagram

```
Student (browser)
  │  POST /api/queries  (JSON + base64 attachment)
  ▼
Next.js Route Handler
  ├── Auth check (Supabase session)
  ├── Role check (student only)
  ├── Zod validation
  ├── Rate limit check (Supabase count)
  ├── Duplicate guard (Supabase count)
  ├── Attachment → adminClient → Supabase Storage
  ├── queries.insert() → trigger sets reference_id + sla_due_at
  ├── query_history.insert() (audit)
  └── Resend emails (non-blocking) → Student + Instructor

Instructor (browser)
  │  PATCH /api/queries/[id]
  ▼
Next.js Route Handler
  ├── Auth + role check
  ├── Zod validation
  ├── queries.update(status, notes, resolved_at)
  ├── query_history.insert() (audit)
  ├── notifications.insert() (student in-app)
  └── Resend email → Student (status notification)
                   → HoD (if escalated)
```

---

## Reference IDs

Queries get a human-readable reference ID generated by a DB trigger:
- Format: `QD-XXXXXXXX-DDMM`
- Example: `QD-ABCD1234-0805` (submitted on May 8)
- Students use this to track their query on the public `/track` page

---

## Role Permissions Summary

| Action | Student | TA | Instructor | Coordinator | HoD | Superadmin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Submit query | ✅ | — | — | — | — | — |
| View own queries | ✅ | — | — | — | — | ✅ |
| View course queries | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update status | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bulk update | — | — | ✅ | ✅ | ✅ | ✅ |
| Delete query | — | — | — | — | ✅ | ✅ |
| View all-dept stats | — | — | — | ✅ | ✅ | ✅ |
| Manage courses | — | — | ✅ | ✅ | ✅ | ✅ |
