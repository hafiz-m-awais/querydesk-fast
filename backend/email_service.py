"""
Email service using the Resend Python SDK.
All templates mirror the TypeScript email.ts originals.
"""
import resend as resend_sdk
from config import get_settings

_settings = get_settings()
resend_sdk.api_key = _settings.resend_api_key

FROM  = _settings.resend_from_email
APP   = _settings.app_name
URL   = _settings.app_url
INST  = _settings.institution


def _esc(s: str | None) -> str:
    s = s or ""
    return (
        s.replace("&", "&amp;")
         .replace("<", "&lt;")
         .replace(">", "&gt;")
         .replace('"', "&quot;")
         .replace("'", "&#39;")
    )


def _footer(course_name: str) -> str:
    return f"""
<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
<p style="color:#6b7280;font-size:12px;margin:0">
  {APP} · {_esc(course_name)} · {INST}<br/>
  Do not reply to this email.
</p>"""


# ── Student: query received ──────────────────────────────────────
def send_submit_confirmation(query: dict, course: dict, student: dict) -> None:
    track_url = f"{URL}/track?roll={query.get('roll_number', '')}"
    html = f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#1B6B45">Query Received</h2>
  <p>Hi {_esc(student.get('full_name') or query.get('student_name'))},</p>
  <p>Your query has been received. Here are the details:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600;width:180px">Reference ID</td>
        <td style="padding:8px;font-family:monospace">{_esc(query.get('reference_id'))}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Query Type</td>
        <td style="padding:8px">{_esc(query.get('query_type'))}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Session</td>
        <td style="padding:8px">{_esc(query.get('session_number')) or '—'}</td></tr>
  </table>
  <a href="{track_url}" style="display:inline-block;background:#1B6B45;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin:8px 0">
    Track Query Status
  </a>
  {_footer(course.get('name', ''))}
</div>"""
    resend_sdk.Emails.send({
        "from": FROM,
        "to": [query["student_email"]],
        "subject": f"[{course.get('name')}] Query received — {query.get('reference_id')}",
        "html": html,
    })


# ── Instructor: new query alert ──────────────────────────────────
def send_instructor_alert(query: dict, course: dict, instructor_email: str) -> None:
    dash_url = f"{URL}/instructor/dashboard"
    urgent = (
        '<span style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;'
        'padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600">⚠ URGENT</span>&nbsp;'
        if query.get("is_urgent") else ""
    )
    html = f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#1B6B45">{urgent}New Student Query</h2>
  <p>A new query has been submitted for <strong>{_esc(course.get('name'))}</strong>.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600;width:180px">Reference ID</td>
        <td style="padding:8px;font-family:monospace">{_esc(query.get('reference_id'))}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Student</td>
        <td style="padding:8px">{_esc(query.get('student_name'))} ({_esc(query.get('roll_number'))})</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Type</td>
        <td style="padding:8px">{_esc(query.get('query_type'))}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Section</td>
        <td style="padding:8px">{_esc(query.get('section'))}</td></tr>
  </table>
  <a href="{dash_url}" style="display:inline-block;background:#1B6B45;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">
    Open Dashboard
  </a>
  {_footer(course.get('name', ''))}
</div>"""
    resend_sdk.Emails.send({
        "from": FROM,
        "to": [instructor_email],
        "subject": f"[{course.get('name')}] New query — {query.get('reference_id')}",
        "html": html,
    })


# ── Student: status update notification ──────────────────────────
def send_status_notification(query: dict, course: dict) -> None:
    status = query.get("status", "")
    color_map = {
        "resolved":  "#166534",
        "rejected":  "#dc2626",
        "escalated": "#7c3aed",
    }
    color = color_map.get(status, "#1B6B45")
    html = f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:{color}">Query {status.title()}</h2>
  <p>Your query <strong>{_esc(query.get('reference_id'))}</strong> has been updated.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600;width:180px">New Status</td>
        <td style="padding:8px"><strong style="color:{color}">{status.upper()}</strong></td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Course</td>
        <td style="padding:8px">{_esc(course.get('name'))}</td></tr>
    {'<tr><td style="padding:8px;background:#f9fafb;font-weight:600">Notes</td><td style="padding:8px">' + _esc(query.get('instructor_notes')) + '</td></tr>' if query.get('instructor_notes') else ''}
  </table>
  {_footer(course.get('name', ''))}
</div>"""
    resend_sdk.Emails.send({
        "from": FROM,
        "to": [query["student_email"]],
        "subject": f"[{course.get('name')}] Query {status} — {query.get('reference_id')}",
        "html": html,
    })


# ── HoD: SLA escalation alert ────────────────────────────────────
def send_escalation_alert(query: dict, course: dict, hod_email: str) -> None:
    html = f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#7c3aed">⚠ Query Escalated — SLA Breached</h2>
  <p>The following query has been escalated because it exceeded the SLA response time.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600;width:180px">Reference ID</td>
        <td style="padding:8px;font-family:monospace">{_esc(query.get('reference_id'))}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Course</td>
        <td style="padding:8px">{_esc(course.get('name'))}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Student</td>
        <td style="padding:8px">{_esc(query.get('student_name'))} ({_esc(query.get('roll_number'))})</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:600">SLA Due</td>
        <td style="padding:8px">{_esc(query.get('sla_due_at'))}</td></tr>
  </table>
  {_footer(course.get('name', ''))}
</div>"""
    resend_sdk.Emails.send({
        "from": FROM,
        "to": [hod_email],
        "subject": f"[ESCALATED] {query.get('reference_id')} — {course.get('name')}",
        "html": html,
    })
