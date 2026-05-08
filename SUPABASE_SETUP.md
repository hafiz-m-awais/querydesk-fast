# Supabase Setup Guide — QueryDesk FAST

Complete step-by-step guide to create and configure your Supabase project from scratch.

---

## Step 1 — Create a Supabase Project

1. Go to **[supabase.com](https://supabase.com)** → Sign up / Log in
2. Click **"New project"**
3. Fill in:
   - **Name**: `querydesk-fast`
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to Pakistan → `ap-south-1 (Mumbai)` or `ap-southeast-1 (Singapore)`
4. Click **"Create new project"** — wait ~2 minutes for it to provision

---

## Step 2 — Get Your API Keys

1. In your project dashboard → **Project Settings** (gear icon) → **API**
2. Copy and save these 3 values:

| What | Where to find it |
|------|-----------------|
| **Project URL** | Under "Project URL" |
| **Anon / Public key** | Under "Project API keys" → `anon` `public` |
| **Service Role key** | Under "Project API keys" → `service_role` ⚠️ Keep secret |

3. Open your `.env.local` file (in the project root) and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Step 3 — Run the Database Schema

1. In your Supabase dashboard → **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Open `supabase/schema.sql` from this project
4. **Copy the entire contents** and paste into the SQL editor
5. Click **"Run"** (or press `Ctrl+Enter`)

You should see: ✅ `Success. No rows returned`

This creates all tables, indexes, triggers, RLS policies, and seed data automatically.

---

## Step 4 — Configure Google OAuth

QueryDesk only allows FAST-NUCES emails (`@nu.edu.pk` / `@isb.nu.edu.pk`). You need Google OAuth for login.

### 4a — Create Google OAuth credentials

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**
2. Create a new project (or use an existing one)
3. Go to **APIs & Services** → **Credentials**
4. Click **"+ Create Credentials"** → **"OAuth client ID"**
5. Application type: **Web application**
6. Name: `QueryDesk`
7. Under **Authorized redirect URIs**, add:
   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```
   *(Replace `YOUR_PROJECT_REF` with the part before `.supabase.co` in your URL)*
8. Click **Create** → copy **Client ID** and **Client Secret**

### 4b — Enable Google provider in Supabase

1. In Supabase → **Authentication** → **Providers**
2. Find **Google** → click to expand → toggle **Enable**
3. Paste your **Client ID** and **Client Secret**
4. Click **Save**

---

## Step 5 — Configure Auth URLs

1. In Supabase → **Authentication** → **URL Configuration**
2. Set:
   - **Site URL**: `http://localhost:3000` (for local dev)
   - **Redirect URLs**: Add `http://localhost:3000/auth/callback`

> For production (Vercel), you'll add your live URL here later.

---

## Step 6 — Create Storage Bucket

Attachment uploads go into a private Supabase Storage bucket.

1. In Supabase → **Storage** (left sidebar)
2. Click **"New bucket"**
3. Fill in:
   - **Name**: `query-attachments`
   - **Public bucket**: ❌ OFF (keep it private)
   - **File size limit**: `5` MB
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain`
4. Click **Save**

### 6a — Add Storage RLS Policies

1. In Supabase → **Storage** → click on `query-attachments` → **Policies**
2. Add these two policies:

**Policy 1 — Students can upload their own files**
- Operation: `INSERT`
- Policy name: `allow_authenticated_upload`
- Expression:
  ```sql
  auth.uid() IS NOT NULL
  ```

**Policy 2 — Staff and owners can view files**
- Operation: `SELECT`
- Policy name: `allow_owner_and_staff_download`
- Expression:
  ```sql
  auth.uid() IS NOT NULL
  ```

> Note: The app uses signed URLs via the service role key (bypasses RLS), so a simple authenticated check is sufficient here.

---

## Step 7 — Set Up Your `.env.local` File

Create a file called `.env.local` in the project root (it's already gitignored):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Resend (for email notifications)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# App URL (use your Vercel URL in production)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Step 8 — Set Staff Roles (After First Login)

When a user signs in for the first time, they are automatically assigned the `student` role.

To make someone an instructor, coordinator, or HoD:

1. In Supabase → **Table Editor** → `profiles`
2. Find the user by their email
3. Edit their `role` column to one of:
   - `student` — default, can submit queries
   - `ta` — teaching assistant, can resolve queries
   - `instructor` — can manage queries for their courses
   - `coordinator` — can manage all courses in a department
   - `hod` — Head of Department, sees all stats
   - `superadmin` — full access

You can also run this SQL query:
```sql
UPDATE profiles
SET role = 'instructor'
WHERE email = 'instructor.name@nu.edu.pk';
```

---

## Step 9 — Add Sample Courses (Optional)

To test the app, add a course via the SQL editor:

```sql
-- First, find the department ID
SELECT id, code, name FROM departments WHERE code = 'CS';

-- Then insert a course (replace the UUIDs)
INSERT INTO courses (department_id, code, name, term, section, instructor_id)
VALUES (
  'YOUR_DEPARTMENT_ID',
  'CS101',
  'Introduction to Programming',
  'Spring 2026',
  'BSCS-1A',
  NULL  -- or set to an instructor's profile ID
);
```

---

## Step 10 — Verify Everything Works

Run the app locally:

```bash
npm run dev
```

Open **http://localhost:3000** and:

1. ✅ Login page loads
2. ✅ Sign in with a `@nu.edu.pk` Google account
3. ✅ Redirected to profile completion page
4. ✅ After profile completion, can submit queries (if courses exist)
5. ✅ Staff roles redirect to their dashboard

---

## Resend Setup (Email Notifications)

1. Go to **[resend.com](https://resend.com)** → sign up
2. Go to **API Keys** → **Create API Key** → copy it into `.env.local`
3. For `RESEND_FROM_EMAIL`:
   - **Local dev**: Use `onboarding@resend.dev` (works without a custom domain)
   - **Production**: Add and verify your own domain at Resend → Domains

---

## Common Issues

| Problem | Fix |
|---------|-----|
| Login redirects to wrong URL | Check Supabase → Auth → URL Configuration |
| "Email not allowed" error | The email must end in `@nu.edu.pk` or `@isb.nu.edu.pk` |
| File upload fails | Check the `query-attachments` bucket exists and RLS policy is set |
| Profile not created on login | Check the `handle_new_user` trigger exists in SQL editor → `Database → Triggers` |
| No courses shown on submit form | Add courses to the `courses` table and set `is_active = true` |
| Can't update query status | Check the user's `role` in the `profiles` table — must be `instructor` or above |
