"""GET /courses — list active courses"""
from typing import Annotated
from fastapi import APIRouter, Depends, Query as QParam
from supabase import create_client, Client

from config import get_settings, Settings
from deps import get_current_profile

router = APIRouter(prefix="/courses", tags=["courses"])


def _authed_client(token: str, settings: Settings) -> Client:
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.auth.set_session(token, "")
    return client


@router.get("")
async def list_courses(
    auth: Annotated[dict, Depends(get_current_profile)],
    settings: Annotated[Settings, Depends(get_settings)],
    department_id: str | None = QParam(default=None),
):
    profile  = auth["profile"]
    token    = auth["token"]
    supabase = _authed_client(token, settings)

    dept_id = department_id or profile.get("department_id")

    q = (
        supabase.table("courses")
        .select(
            "id,code,name,term,section,session_label,session_count,"
            "enabled_query_types,sla_response_hours,"
            "instructor:profiles!courses_instructor_id_fkey(id,full_name)"
        )
        .eq("is_active", True)
        .order("name")
    )

    # Students only see their department's courses
    if profile.get("role") == "student" and dept_id:
        q = q.eq("department_id", dept_id)

    resp = q.execute()
    return {"data": resp.data or []}
