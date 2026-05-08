import { Resend } from 'resend'
import { APP_NAME, APP_URL, INSTITUTION } from '@/lib/constants'
import type { Query, Course, Profile } from '@/types'

function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM_EMAIL || 'querydesk@noreply.nu.edu.pk'

// ── Shared footer ─────────────────────────────────────────────────
function footer(course: Course) {
  return `
<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
<p style="color:#6b7280;font-size:12px;margin:0">
  ${APP_NAME} · ${course.name} · ${INSTITUTION}<br/>
  Do not reply to this email.
</p>`
}

// ── Student: query received confirmation ─────────────────────────
export async function sendSubmitConfirmation(query: Query, course: Course, student: Profile) {
  const trackUrl = `${APP_URL}/track?roll=${encodeURIComponent(query.roll_number)}`
  await resend.emails.send({
    from:    FROM,
    to:      query.student_email,
    subject: `[${course.name}] Query received — ${query.reference_id}`,
    html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#1B6B45">Query Received</h2>
  <p>Hi ${student.full_name || query.student_name},</p>
  <p>Your query has been received. Here are the details:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600;width:180px">Reference ID</td>
        <td style="padding:8px;font-family:monospace">${query.reference_id}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Query Type</td>
        <td style="padding:8px">${query.query_type}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Session</td>
        <td style="padding:8px">${query.session_number || '—'}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Submitted</td>
        <td style="padding:8px">${new Date(query.submitted_at).toLocaleString()}</td></tr>
  </table>
  <a href="${trackUrl}" style="display:inline-block;background:#1B6B45;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin:8px 0">
    Track Query Status
  </a>
  ${footer(course)}
</div>`,
  })
}

// ── Instructor: new query alert ───────────────────────────────────
export async function sendInstructorAlert(query: Query, course: Course, instructorEmail: string) {
  const dashUrl  = `${APP_URL}/instructor/dashboard`
  const urgentBadge = query.is_urgent
    ? '<span style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600">⚠ URGENT</span>&nbsp;'
    : ''
  await resend.emails.send({
    from:    FROM,
    to:      instructorEmail,
    subject: `[${course.name}] ${query.is_urgent ? '[URGENT] ' : ''}New ${query.query_type} query — ${query.student_name}`,
    html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#1B6B45">${urgentBadge}New Query</h2>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600;width:180px">Reference</td>
        <td style="padding:8px;font-family:monospace">${query.reference_id}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Student</td>
        <td style="padding:8px">${query.student_name} (${query.roll_number})</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Section</td>
        <td style="padding:8px">${query.section}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Type</td>
        <td style="padding:8px">${query.query_type}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Session</td>
        <td style="padding:8px">${query.session_number || '—'} on ${query.session_date || '—'}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Description</td>
        <td style="padding:8px">${esc(query.description)}</td></tr>
  </table>
  <a href="${dashUrl}" style="display:inline-block;background:#1B6B45;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">
    Open Dashboard
  </a>
  ${footer(course)}
</div>`,
  })
}

// ── Student: status changed notification ─────────────────────────
export async function sendStatusNotification(query: Query, course: Course) {
  const isResolved = query.status === 'resolved'
  const isEscalated = query.status === 'escalated'
  const trackUrl  = `${APP_URL}/track?roll=${encodeURIComponent(query.roll_number)}`
  const statusColor = { resolved: '#15803d', rejected: '#dc2626', escalated: '#7c3aed', reviewing: '#2563eb' }
    [query.status] ?? '#374151'

  await resend.emails.send({
    from:    FROM,
    to:      query.student_email,
    subject: `[${course.name}] ${query.status.charAt(0).toUpperCase() + query.status.slice(1)} — ${query.reference_id}`,
    html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:${statusColor}">
    Query ${query.status.charAt(0).toUpperCase() + query.status.slice(1)}
  </h2>
  <p>Hi ${query.student_name},</p>
  <p>Your query <strong>${query.reference_id}</strong> has been marked as
     <strong style="color:${statusColor}">${query.status}</strong>.</p>
  ${query.instructor_notes
    ? `<div style="background:#f9fafb;border-left:4px solid #1B6B45;padding:12px;margin:16px 0">
         <strong>Instructor note:</strong><br/>${esc(query.instructor_notes)}
       </div>`
    : ''}
  ${isResolved
    ? '<p>Your query has been resolved. If you have further questions, please raise a new query.</p>'
    : ''}
  ${isEscalated
    ? '<p>Your query has been escalated to the department coordinator for further review.</p>'
    : ''}
  <a href="${trackUrl}" style="display:inline-block;background:#1B6B45;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin:8px 0">
    View Query Status
  </a>
  ${footer(course)}
</div>`,
  })
}

// ── HoD: SLA breach / escalation alert ───────────────────────────
export async function sendEscalationAlert(query: Query, course: Course, hodEmail: string) {
  await resend.emails.send({
    from:    FROM,
    to:      hodEmail,
    subject: `[${course.name}] SLA Breach — Query ${query.reference_id} needs attention`,
    html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#dc2626">⚠ SLA Breach — Escalated Query</h2>
  <p>The following query has breached its SLA and requires your attention:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#fef2f2;font-weight:600;width:180px">Reference</td>
        <td style="padding:8px;font-family:monospace">${query.reference_id}</td></tr>
    <tr><td style="padding:8px;background:#fef2f2;font-weight:600">Student</td>
        <td style="padding:8px">${query.student_name} (${query.roll_number})</td></tr>
    <tr><td style="padding:8px;background:#fef2f2;font-weight:600">Course</td>
        <td style="padding:8px">${course.name} — ${course.section}</td></tr>
    <tr><td style="padding:8px;background:#fef2f2;font-weight:600">Type</td>
        <td style="padding:8px">${query.query_type}</td></tr>
    <tr><td style="padding:8px;background:#fef2f2;font-weight:600">Submitted</td>
        <td style="padding:8px">${new Date(query.submitted_at).toLocaleString()}</td></tr>
    <tr><td style="padding:8px;background:#fef2f2;font-weight:600">SLA Due</td>
        <td style="padding:8px;color:#dc2626">${query.sla_due_at ? new Date(query.sla_due_at).toLocaleString() : '—'}</td></tr>
  </table>
  ${footer(course)}
</div>`,
  })
}
