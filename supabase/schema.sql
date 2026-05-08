-- ═══════════════════════════════════════════════════════════════════
--  QueryDesk — Supabase PostgreSQL Schema
--  Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════════

-- ── Extensions ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enums ─────────────────────────────────────────────────────────
CREATE TYPE user_role     AS ENUM ('student', 'ta', 'instructor', 'coordinator', 'hod', 'superadmin');
CREATE TYPE query_status  AS ENUM ('pending', 'reviewing', 'resolved', 'rejected', 'escalated');
CREATE TYPE query_type    AS ENUM ('attendance', 'marks', 'assignment', 'project', 'final', 'other');
CREATE TYPE campus_code   AS ENUM ('ISB', 'LHR', 'KHI', 'PEW', 'CFD');

-- ── Campuses ──────────────────────────────────────────────────────
CREATE TABLE campuses (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       campus_code UNIQUE NOT NULL,
  name       TEXT        NOT NULL,
  city       TEXT        NOT NULL,
  is_active  BOOLEAN     DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO campuses (code, name, city) VALUES
  ('ISB', 'FAST-NUCES Islamabad',           'Islamabad'),
  ('LHR', 'FAST-NUCES Lahore',              'Lahore'),
  ('KHI', 'FAST-NUCES Karachi',             'Karachi'),
  ('PEW', 'FAST-NUCES Peshawar',            'Peshawar'),
  ('CFD', 'FAST-NUCES Chiniot-Faisalabad',  'Faisalabad');

-- ── Departments ───────────────────────────────────────────────────
CREATE TABLE departments (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id  UUID    REFERENCES campuses(id) ON DELETE CASCADE,
  code       TEXT    NOT NULL,    -- CS, SE, EE, BBA, BSBA, MBA, DS, AI, MS
  name       TEXT    NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campus_id, code)
);

-- ── Profiles (extends auth.users) ─────────────────────────────────
CREATE TABLE profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT        UNIQUE NOT NULL,
  full_name     TEXT,
  roll_number   TEXT        UNIQUE,          -- null for staff
  role          user_role   NOT NULL DEFAULT 'student',
  campus_id     UUID        REFERENCES campuses(id),
  department_id UUID        REFERENCES departments(id),
  batch_year    INTEGER,                      -- e.g. 2023
  avatar_url    TEXT,
  is_active     BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Courses ───────────────────────────────────────────────────────
CREATE TABLE courses (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id         UUID    REFERENCES departments(id) ON DELETE CASCADE,
  code                  TEXT    NOT NULL,           -- CS101
  name                  TEXT    NOT NULL,
  term                  TEXT    NOT NULL,           -- Spring 2026
  section               TEXT    NOT NULL,           -- BSCS-6A
  instructor_id         UUID    REFERENCES profiles(id),
  session_count         INTEGER DEFAULT 14,
  session_label         TEXT    DEFAULT 'Lab',      -- Lab | Lecture
  is_lab                BOOLEAN DEFAULT TRUE,
  query_window_days     INTEGER DEFAULT 7,          -- days after session to raise query
  max_attachment_mb     INTEGER DEFAULT 5,
  enabled_query_types   JSONB   DEFAULT '{"attendance":true,"marks":true,"assignment":true,"project":true,"final":true}',
  sla_response_hours    INTEGER DEFAULT 48,         -- resolve within N hours
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department_id, code, term, section)
);

-- ── Course Teaching Assistants ─────────────────────────────────────
CREATE TABLE course_tas (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  ta_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(course_id, ta_id)
);

-- ── Queries ───────────────────────────────────────────────────────
CREATE TABLE queries (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id      TEXT         UNIQUE NOT NULL,
  course_id         UUID         REFERENCES courses(id),
  student_id        UUID         REFERENCES profiles(id),

  -- Denormalized student info (accurate even if profile changes)
  student_email     TEXT         NOT NULL,
  student_name      TEXT         NOT NULL,
  roll_number       TEXT         NOT NULL,
  section           TEXT         NOT NULL,

  -- Query details
  query_type        query_type   NOT NULL,
  session_number    TEXT,                  -- lab/lecture number(s)
  session_date      DATE,
  description       TEXT         NOT NULL CHECK (char_length(description) BETWEEN 10 AND 2000),
  extra_date        DATE,
  marks_awarded     NUMERIC(5,2),
  marks_expected    NUMERIC(5,2),
  issue_reason      TEXT         CHECK (char_length(issue_reason)  <= 500),
  request_type      TEXT         CHECK (char_length(request_type)  <= 100),
  is_urgent         BOOLEAN      DEFAULT FALSE,

  -- Status
  status            query_status DEFAULT 'pending',
  instructor_notes  TEXT         CHECK (char_length(instructor_notes) <= 1000),
  resolved_by       UUID         REFERENCES profiles(id),
  resolved_at       TIMESTAMPTZ,
  escalated_at      TIMESTAMPTZ,
  escalated_to      UUID         REFERENCES profiles(id),

  -- Attachment (Supabase Storage)
  attachment_path   TEXT,          -- storage bucket path
  attachment_name   TEXT,
  attachment_mime   TEXT,

  -- SLA tracking
  sla_due_at        TIMESTAMPTZ,  -- auto-set on insert from course.sla_response_hours

  -- Metadata
  submitted_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Query History / Audit Trail ────────────────────────────────────
CREATE TABLE query_history (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id    UUID         REFERENCES queries(id) ON DELETE CASCADE,
  actor_id    UUID         REFERENCES profiles(id),
  action      TEXT         NOT NULL,    -- submitted | status_changed | note_added | escalated | deleted
  old_status  query_status,
  new_status  query_status,
  note        TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ── In-app Notifications ──────────────────────────────────────────
CREATE TABLE notifications (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID    REFERENCES profiles(id) ON DELETE CASCADE,
  query_id     UUID    REFERENCES queries(id)  ON DELETE CASCADE,
  title        TEXT    NOT NULL,
  message      TEXT    NOT NULL,
  is_read      BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── SLA Escalation Rules ──────────────────────────────────────────
CREATE TABLE sla_rules (
  id               UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id    UUID       REFERENCES departments(id) ON DELETE CASCADE,
  query_type       query_type,
  response_hours   INTEGER    DEFAULT 48,
  escalate_to_hod  BOOLEAN    DEFAULT TRUE,
  is_active        BOOLEAN    DEFAULT TRUE
);

-- ═══════════════════════════════════════════════════════════════════
--  INDEXES
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX idx_queries_student_id    ON queries(student_id);
CREATE INDEX idx_queries_course_id     ON queries(course_id);
CREATE INDEX idx_queries_status        ON queries(status);
CREATE INDEX idx_queries_submitted_at  ON queries(submitted_at DESC);
CREATE INDEX idx_queries_roll_number   ON queries(roll_number);
CREATE INDEX idx_queries_reference_id  ON queries(reference_id);
CREATE INDEX idx_query_history_query   ON query_history(query_id);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read);

-- ═══════════════════════════════════════════════════════════════════
--  FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════════════════

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_queries_updated_at  BEFORE UPDATE ON queries  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_courses_updated_at  BEFORE UPDATE ON courses  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-generate reference_id
CREATE OR REPLACE FUNCTION generate_reference_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference_id IS NULL OR NEW.reference_id = '' THEN
    NEW.reference_id := 'QD-' || UPPER(SUBSTRING(encode(gen_random_bytes(5), 'hex'), 1, 8)) || '-' || to_char(NOW(), 'YYMM');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_queries_ref_id BEFORE INSERT ON queries FOR EACH ROW EXECUTE FUNCTION generate_reference_id();

-- Auto-set SLA due date on insert
CREATE OR REPLACE FUNCTION set_sla_due_at()
RETURNS TRIGGER AS $$
DECLARE sla_hours INTEGER;
BEGIN
  SELECT COALESCE(c.sla_response_hours, 48) INTO sla_hours
  FROM courses c WHERE c.id = NEW.course_id;
  NEW.sla_due_at := NOW() + (sla_hours || ' hours')::INTERVAL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_queries_sla BEFORE INSERT ON queries FOR EACH ROW EXECUTE FUNCTION set_sla_due_at();

-- Auto-create profile on first sign-in
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _email TEXT := NEW.email;
  _role  user_role := 'student';
BEGIN
  -- Role inference: staff emails (manually set role after)
  INSERT INTO profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    _email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    _role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auth_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ═══════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE campuses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_tas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_rules     ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: is current user a staff member (ta or above)
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
  SELECT role IN ('ta','instructor','coordinator','hod','superadmin')
  FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Profiles ──────────────────────────────────────────────────────
-- Anyone logged in can read their own profile
CREATE POLICY "profiles_read_own"   ON profiles FOR SELECT USING (id = auth.uid());
-- Staff can read profiles in their department
CREATE POLICY "profiles_read_staff" ON profiles FOR SELECT USING (is_staff());
-- Users can update their own profile (non-role fields)
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());

-- ── Campuses & Departments (public read) ──────────────────────────
CREATE POLICY "campuses_read_all"     ON campuses     FOR SELECT USING (TRUE);
CREATE POLICY "departments_read_all"  ON departments  FOR SELECT USING (TRUE);
CREATE POLICY "sla_rules_read_staff"  ON sla_rules    FOR SELECT USING (is_staff());

-- ── Courses ───────────────────────────────────────────────────────
-- Anyone can read active courses (needed for student submit form)
CREATE POLICY "courses_read_active"      ON courses FOR SELECT USING (is_active = TRUE);
-- Instructor/coordinator can update their courses
CREATE POLICY "courses_write_instructor" ON courses FOR UPDATE
  USING (instructor_id = auth.uid() OR current_user_role() IN ('coordinator','hod','superadmin'));
-- Coordinator+ can insert/delete
CREATE POLICY "courses_insert_coord"  ON courses FOR INSERT WITH CHECK (current_user_role() IN ('coordinator','hod','superadmin'));
CREATE POLICY "courses_delete_coord"  ON courses FOR DELETE USING (current_user_role() IN ('hod','superadmin'));

-- ── Queries ───────────────────────────────────────────────────────
-- Students can read their own queries
CREATE POLICY "queries_student_read" ON queries FOR SELECT
  USING (student_id = auth.uid());

-- Students can insert (submit) queries
CREATE POLICY "queries_student_insert" ON queries FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Instructor can read queries for their courses
CREATE POLICY "queries_instructor_read" ON queries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses c WHERE c.id = course_id AND c.instructor_id = auth.uid()
    )
  );

-- TA can read queries for courses they assist
CREATE POLICY "queries_ta_read" ON queries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course_tas ct WHERE ct.course_id = course_id AND ct.ta_id = auth.uid()
    )
  );

-- Instructor/TA can update status + notes
CREATE POLICY "queries_staff_update" ON queries FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = course_id AND c.instructor_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM course_tas ct WHERE ct.course_id = course_id AND ct.ta_id = auth.uid())
    OR current_user_role() IN ('coordinator','hod','superadmin')
  );

-- HoD can read all queries in their department
CREATE POLICY "queries_hod_read" ON queries FOR SELECT
  USING (
    current_user_role() IN ('hod','superadmin')
    AND EXISTS (
      SELECT 1 FROM courses c
      JOIN departments d ON d.id = c.department_id
      JOIN profiles p    ON p.department_id = d.id AND p.id = auth.uid()
      WHERE c.id = course_id
    )
  );

-- Superadmin can do anything
CREATE POLICY "queries_superadmin_all" ON queries FOR ALL USING (current_user_role() = 'superadmin');

-- ── Query History ─────────────────────────────────────────────────
CREATE POLICY "history_student_read" ON query_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM queries q WHERE q.id = query_id AND q.student_id = auth.uid()));
CREATE POLICY "history_staff_read"   ON query_history FOR SELECT USING (is_staff());
CREATE POLICY "history_insert_all"   ON query_history FOR INSERT WITH CHECK (actor_id = auth.uid());

-- ── Notifications ──────────────────────────────────────────────────
CREATE POLICY "notif_read_own"   ON notifications FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE USING (recipient_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
--  STORAGE BUCKETS
--  Run in: Supabase Dashboard → Storage → New bucket
-- ═══════════════════════════════════════════════════════════════════
-- Bucket name: query-attachments   (private)
-- Max file size: 5 MB
-- Allowed MIME: image/jpeg, image/png, image/webp, application/pdf, text/plain
--
-- Storage RLS (add in Supabase Dashboard → Storage → Policies):
-- INSERT: auth.uid() IS NOT NULL
-- SELECT: auth.uid() IS NOT NULL AND (
--           storage.foldername(name)[1] = auth.uid()::text   -- student's own files
--           OR is_staff()                                     -- staff can view any
--         )

-- ═══════════════════════════════════════════════════════════════════
--  SEED: FAST-NUCES ISB sample data
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE isb_id UUID;
DECLARE cs_id  UUID;
BEGIN
  SELECT id INTO isb_id FROM campuses WHERE code = 'ISB';

  INSERT INTO departments (campus_id, code, name) VALUES
    (isb_id, 'CS',   'Computer Science'),
    (isb_id, 'SE',   'Software Engineering'),
    (isb_id, 'EE',   'Electrical Engineering'),
    (isb_id, 'BSBA', 'Business Administration'),
    (isb_id, 'DS',   'Data Science'),
    (isb_id, 'AI',   'Artificial Intelligence')
  ON CONFLICT DO NOTHING;

  SELECT id INTO cs_id FROM departments WHERE campus_id = isb_id AND code = 'CS';

  INSERT INTO sla_rules (department_id, query_type, response_hours, escalate_to_hod) VALUES
    (cs_id, 'attendance', 24,  TRUE),
    (cs_id, 'marks',      48,  TRUE),
    (cs_id, 'assignment', 48,  FALSE),
    (cs_id, 'project',    72,  FALSE),
    (cs_id, 'final',      24,  TRUE)
  ON CONFLICT DO NOTHING;
END $$;
