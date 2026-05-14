"""POST /queries/bulk — bulk status update (staff)"""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from supabase import create_client, Client
from datetime import datetime, timezone

from config import get_settings, Settings
from deps import get_current_profile
from models import BulkUpdateBody
from email_service import send_status_notification

router = APIRouter(prefix="/queries/bulk", tags=["queries"])

ALLOWED_ROLES = {"instructor", "coordinator", "hod", "superadmin"}


def _authed_client(token: str, settings: Settings) -> Client:
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.auth.set_session(token, "")
    return client


def _admin_client(settings: Settings) -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


@router.post("")
async def bulk_update(
    body: BulkUpdateBody,
    auth: Annotated[dict, Depends(get_current_profile)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    profile = auth["profile"]
    token   = auth["token"]
    user    = auth["user"]

    if profile["role"] not in ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="Forbidden")

    supabase  = _authed_client(token, settings)
    admin     = _admin_client(settings)
    query_ids = [str(qid) for qid in body.query_ids]

    # Fetch current state of all targeted queries
    existing_resp = (
        supabase.table("queries")
        .select("*, course:courses(*)")
        .in_("id", query_ids)
        .execute()
    )
    queries = existing_resp.data or []

    now_iso    = datetime.now(timezone.utc).isoformat()
    resolved   = body.status in ("resolved", "rejected")
    update_pl: dict = {
        "status":     body.status,
        "updated_at": now_iso,
        **({"instructor_notes": body.notes} if body.notes else {}),
        **({"resolved_at": now_iso, "resolved_by": user.id} if resolved else {}),
    }

    supabase.table("queries").update(update_pl).in_("id", query_ids).execute()

    # Audit rows
    history_rows = [
        {
            "query_id":   qid,
            "actor_id":   user.id,
            "action":     "status_changed",
            "old_status": next((q["status"] for q in queries if q["id"] == qid), None),
            "new_status": body.status,
            "note":       body.notes or "",
        }
        for qid in query_ids
    ]
    supabase.table("query_history").insert(history_rows).execute()

    # Emails for resolved/rejected
    if resolved:
        for q in queries:
            course = q.get("course")
            if course:
                try:
                    send_status_notification({**q, **update_pl}, course)
                except Exception:
                    pass

    return {"message": f"Updated {len(query_ids)} queries.", "data": {"updated": len(query_ids)}}
