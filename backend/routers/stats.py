"""GET /stats — dashboard analytics for instructor / hod"""
from typing import Annotated
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query as QParam
from supabase import create_client, Client

from config import get_settings, Settings
from deps import get_current_profile

router = APIRouter(prefix="/stats", tags=["stats"])


def _authed_client(token: str, settings: Settings) -> Client:
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.auth.set_session(token, "")
    return client


@router.get("")
async def get_stats(
    auth: Annotated[dict, Depends(get_current_profile)],
    settings: Annotated[Settings, Depends(get_settings)],
    course_id: str | None = QParam(default=None),
):
    profile = auth["profile"]
    token   = auth["token"]

    if profile["role"] == "student":
        raise HTTPException(status_code=403, detail="Forbidden")

    supabase = _authed_client(token, settings)

    q = supabase.table("queries").select(
        "status,query_type,section,course_id,is_urgent,sla_due_at,resolved_at,submitted_at"
    )
    if course_id:
        q = q.eq("course_id", course_id)

    resp = q.execute()
    rows = resp.data or []

    now = datetime.now(timezone.utc).timestamp() * 1000
    stats: dict = {
        "total": 0, "pending": 0, "reviewing": 0, "resolved": 0,
        "rejected": 0, "escalated": 0, "urgent": 0, "sla_breached": 0,
        "by_type": {}, "by_section": {}, "by_course": {},
        "avg_resolution_hours": 0,
    }

    total_ms   = 0.0
    res_count  = 0

    for row in rows:
        stats["total"] += 1
        s = row.get("status", "")
        if s in stats:
            stats[s] += 1
        if row.get("is_urgent"):
            stats["urgent"] += 1

        sla_due = row.get("sla_due_at")
        if sla_due and datetime.fromisoformat(sla_due.replace("Z", "+00:00")).timestamp() * 1000 < now:
            if s not in ("resolved", "rejected"):
                stats["sla_breached"] += 1

        qt = row.get("query_type", "")
        stats["by_type"][qt]              = stats["by_type"].get(qt, 0) + 1
        sec = row.get("section", "")
        stats["by_section"][sec]          = stats["by_section"].get(sec, 0) + 1
        cid = row.get("course_id", "")
        stats["by_course"][cid]           = stats["by_course"].get(cid, 0) + 1

        resolved_at  = row.get("resolved_at")
        submitted_at = row.get("submitted_at")
        if resolved_at and submitted_at:
            t1 = datetime.fromisoformat(resolved_at.replace("Z", "+00:00")).timestamp()
            t0 = datetime.fromisoformat(submitted_at.replace("Z", "+00:00")).timestamp()
            ms = (t1 - t0) * 1000
            if ms > 0:
                total_ms  += ms
                res_count += 1

    if res_count > 0:
        stats["avg_resolution_hours"] = round(total_ms / res_count / 3_600_000 * 10) / 10

    return {"data": stats}
