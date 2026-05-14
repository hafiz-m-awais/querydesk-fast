"""
GET  /queries          — list queries (instructor/hod/staff)
POST /queries          — submit new query (student)
GET  /queries/{id}     — single query with history
PATCH /queries/{id}    — update status + notes (staff)
DELETE /queries/{id}   — hard delete (hod/superadmin)
POST /queries/bulk     — bulk status update (staff)
"""
import base64
import re
from datetime import datetime, timezone, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query as QParam
from supabase import create_client, Client

from config import get_settings, Settings
from deps import get_current_profile
from models import SubmitQueryBody, UpdateStatusBody, BulkUpdateBody, ALLOWED_MIMES, MAX_ATTACHMENT_MB, MAX_SUBMISSIONS_PER_HOUR
from email_service import send_submit_confirmation, send_instructor_alert, send_status_notification, send_escalation_alert

router = APIRouter(prefix="/queries", tags=["queries"])

STAFF_ROLES = {"ta", "instructor", "coordinator", "hod", "superadmin"}
HOD_ROLES   = {"hod", "superadmin"}


def _authed_client(token: str, settings: Settings) -> Client:
    """Supabase client carrying the user's JWT (RLS-aware)."""
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.auth.set_session(token, "")
    return client


def _admin_client(settings: Settings) -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


# ── GET /queries ─────────────────────────────────────────────────
@router.get("")
async def list_queries(
    auth: Annotated[dict, Depends(get_current_profile)],
    settings: Annotated[Settings, Depends(get_settings)],
    course_id:   str | None = QParam(default=None),
    status:      str | None = QParam(default=None),
    page:        int        = QParam(default=1, ge=1),
    limit:       int        = QParam(default=50, ge=1, le=100),
    sla_breached: str | None = QParam(default=None),
):
    profile = auth["profile"]
    token   = auth["token"]
    user    = auth["user"]

    if profile["role"] == "student":
        raise HTTPException(status_code=403, detail="Forbidden")

    supabase = _authed_client(token, settings)
    offset   = (page - 1) * limit

    q = (
        supabase.table("queries")
        .select(
            "*, course:courses(id,name,code,section,session_label), "
            "student:profiles!queries_student_id_fkey(id,full_name,roll_number,avatar_url)",
            count="exact",
        )
        .order("submitted_at", desc=True)
        .range(offset, offset + limit - 1)
    )

    if profile["role"] not in HOD_ROLES:
        courses_resp = (
            supabase.table("courses")
            .select("id")
            .eq("instructor_id", user.id)
            .eq("is_active", True)
            .execute()
        )
        course_ids = [c["id"] for c in (courses_resp.data or [])]
        if not course_ids:
            return {"data": [], "total": 0, "page": page, "limit": limit}
        q = q.in_("course_id", course_ids)

    if course_id:
        q = q.eq("course_id", course_id)
    if status:
        q = q.eq("status", status)
    if sla_breached == "1":
        now_iso = datetime.now(timezone.utc).isoformat()
        q = q.lt("sla_due_at", now_iso).not_.in_("status", ["resolved", "rejected"])

    resp = q.execute()
    return {"data": resp.data or [], "total": resp.count or 0, "page": page, "limit": limit}


# ── POST /queries ────────────────────────────────────────────────
@router.post("", status_code=201)
async def submit_query(
    body: SubmitQueryBody,
    auth: Annotated[dict, Depends(get_current_profile)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    profile = auth["profile"]
    token   = auth["token"]
    user    = auth["user"]

    if profile["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students can submit queries.")

    supabase = _authed_client(token, settings)
    admin    = _admin_client(settings)

    # Validate course
    course_resp = (
        supabase.table("courses")
        .select("*, department:departments(campus_id,code,name)")
        .eq("id", str(body.course_id))
        .eq("is_active", True)
        .single()
        .execute()
    )
    if not course_resp.data:
        raise HTTPException(status_code=404, detail="Course not found or inactive.")

    course = course_resp.data

    # Rate limit
    one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    rate_resp = (
        supabase.table("queries")
        .select("id", count="exact")
        .eq("student_id", user.id)
        .gte("submitted_at", one_hour_ago)
        .execute()
    )
    if (rate_resp.count or 0) >= MAX_SUBMISSIONS_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many submissions. Please wait before submitting again.")

    # Duplicate guard
    one_day_ago = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    dup_resp = (
        supabase.table("queries")
        .select("id", count="exact")
        .eq("student_id", user.id)
        .eq("course_id", str(body.course_id))
        .eq("query_type", body.query_type)
        .eq("session_number", body.session_number or "")
        .gte("submitted_at", one_day_ago)
        .execute()
    )
    if (dup_resp.count or 0) > 0:
        raise HTTPException(status_code=409, detail="A query of this type for the same session was already submitted today.")

    # Attachment upload
    attachment_path = attachment_name = attachment_mime = None
    if body.attachment:
        att = body.attachment
        if att.mime not in ALLOWED_MIMES:
            raise HTTPException(status_code=422, detail=f"File type not allowed: {att.mime}")
        raw_bytes = base64.b64decode(att.data)
        if len(raw_bytes) > MAX_ATTACHMENT_MB * 1024 * 1024:
            raise HTTPException(status_code=422, detail=f"File exceeds {MAX_ATTACHMENT_MB} MB limit")
        safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", att.name)
        path = f"{user.id}/{int(datetime.now().timestamp() * 1000)}_{safe_name}"
        upload_resp = admin.storage.from_("query-attachments").upload(
            path, raw_bytes, {"content-type": att.mime, "upsert": "false"}
        )
        if hasattr(upload_resp, "error") and upload_resp.error:
            raise HTTPException(status_code=500, detail="File upload failed: " + str(upload_resp.error))
        attachment_path = path
        attachment_name = att.name
        attachment_mime = att.mime

    # Insert query
    insert_data = {
        "course_id":       str(body.course_id),
        "student_id":      user.id,
        "student_email":   user.email,
        "student_name":    profile.get("full_name") or "",
        "roll_number":     profile.get("roll_number") or "",
        "section":         course["section"],
        "query_type":      body.query_type,
        "session_number":  body.session_number,
        "session_date":    body.session_date,
        "description":     body.description,
        "extra_date":      body.extra_date,
        "marks_awarded":   body.marks_awarded,
        "marks_expected":  body.marks_expected,
        "issue_reason":    body.issue_reason,
        "request_type":    body.request_type,
        "is_urgent":       body.is_urgent,
        "attachment_path": attachment_path,
        "attachment_name": attachment_name,
        "attachment_mime": attachment_mime,
    }
    insert_resp = supabase.table("queries").insert(insert_data).execute()
    if not insert_resp.data:
        raise HTTPException(status_code=500, detail="Failed to save query.")

    new_query = insert_resp.data[0]

    # Fire-and-forget emails
    try:
        send_submit_confirmation(new_query, course, profile)
    except Exception:
        pass
    try:
        if course.get("instructor_id"):
            instr_resp = (
                admin.table("profiles")
                .select("email")
                .eq("id", course["instructor_id"])
                .single()
                .execute()
            )
            if instr_resp.data:
                send_instructor_alert(new_query, course, instr_resp.data["email"])
    except Exception:
        pass

    return {"data": new_query, "message": "Query submitted successfully."}


# ── GET /queries/bulk — must come BEFORE /{id} ──────────────────
# (Handled separately in bulk router — see routers/bulk.py)


# ── GET /queries/{id} ────────────────────────────────────────────
@router.get("/{query_id}")
async def get_query(
    query_id: str,
    auth: Annotated[dict, Depends(get_current_profile)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    token    = auth["token"]
    supabase = _authed_client(token, settings)

    q_resp = (
        supabase.table("queries")
        .select(
            "*, course:courses(id,name,code,section,term,session_label,sla_response_hours), "
            "student:profiles!queries_student_id_fkey(id,full_name,roll_number,avatar_url)"
        )
        .eq("id", query_id)
        .single()
        .execute()
    )
    if not q_resp.data:
        raise HTTPException(status_code=404, detail="Query not found")

    h_resp = (
        supabase.table("query_history")
        .select("*, actor:profiles!query_history_actor_id_fkey(id,full_name,role)")
        .eq("query_id", query_id)
        .order("created_at")
        .execute()
    )

    return {"data": {**q_resp.data, "history": h_resp.data or []}}


# ── PATCH /queries/{id} ──────────────────────────────────────────
@router.patch("/{query_id}")
async def update_query(
    query_id: str,
    body: UpdateStatusBody,
    auth: Annotated[dict, Depends(get_current_profile)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    profile = auth["profile"]
    token   = auth["token"]
    user    = auth["user"]

    if profile["role"] not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Forbidden")

    supabase = _authed_client(token, settings)
    admin    = _admin_client(settings)

    existing_resp = supabase.table("queries").select("*").eq("id", query_id).single().execute()
    if not existing_resp.data:
        raise HTTPException(status_code=404, detail="Query not found")
    existing = existing_resp.data

    now_iso = datetime.now(timezone.utc).isoformat()
    update_payload: dict = {
        "status":           body.status,
        "instructor_notes": body.instructor_notes or existing.get("instructor_notes"),
        "updated_at":       now_iso,
    }
    if body.status in ("resolved", "rejected"):
        update_payload["resolved_by"] = user.id
        update_payload["resolved_at"] = now_iso
    if body.status == "escalated":
        update_payload["escalated_at"] = now_iso

    supabase.table("queries").update(update_payload).eq("id", query_id).execute()

    # Audit log
    supabase.table("query_history").insert({
        "query_id":   query_id,
        "actor_id":   user.id,
        "action":     "status_changed",
        "old_status": existing["status"],
        "new_status": body.status,
        "note":       body.instructor_notes or "",
    }).execute()

    # Notification
    supabase.table("notifications").insert({
        "recipient_id": existing["student_id"],
        "query_id":     query_id,
        "title":        f"Query {body.status}",
        "message":      f"Your query {existing.get('reference_id')} has been marked as {body.status}.",
    }).execute()

    # Emails
    updated_query = {**existing, **update_payload}
    if body.status in ("resolved", "rejected", "escalated"):
        try:
            course_resp = admin.table("courses").select("*").eq("id", existing["course_id"]).single().execute()
            if course_resp.data:
                send_status_notification(updated_query, course_resp.data)
                if body.status == "escalated":
                    dept_resp = (
                        admin.table("departments")
                        .select("*, hod:profiles!departments_hod_id_fkey(email)")
                        .eq("id", course_resp.data.get("department_id"))
                        .single()
                        .execute()
                    )
                    if dept_resp.data:
                        hod = dept_resp.data.get("hod") or {}
                        hod_email = hod.get("email") if isinstance(hod, dict) else None
                        if hod_email:
                            send_escalation_alert(updated_query, course_resp.data, hod_email)
        except Exception:
            pass

    return {"message": "Updated successfully."}


# ── DELETE /queries/{id} ─────────────────────────────────────────
@router.delete("/{query_id}", status_code=200)
async def delete_query(
    query_id: str,
    auth: Annotated[dict, Depends(get_current_profile)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    profile = auth["profile"]
    token   = auth["token"]
    user    = auth["user"]

    if profile["role"] not in HOD_ROLES:
        raise HTTPException(status_code=403, detail="Forbidden")

    supabase = _authed_client(token, settings)
    supabase.table("query_history").insert({
        "query_id": query_id, "actor_id": user.id, "action": "deleted",
    }).execute()

    resp = supabase.table("queries").delete().eq("id", query_id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Query not found")

    return {"message": "Deleted."}
