"""GET /track?roll=23I-1234 — public, unauthenticated query tracker"""
from fastapi import APIRouter, Depends, HTTPException, Query as QParam
from supabase import create_client
from typing import Annotated

from config import get_settings, Settings

router = APIRouter(prefix="/track", tags=["track"])


@router.get("")
async def track_query(
    settings: Annotated[Settings, Depends(get_settings)],
    roll: str = QParam(min_length=1, max_length=20),
):
    roll = roll.strip().upper()

    admin = create_client(settings.supabase_url, settings.supabase_service_role_key)
    resp  = (
        admin.table("queries")
        .select(
            "reference_id,query_type,status,is_urgent,sla_due_at,"
            "submitted_at,resolved_at,course:courses(name,section),instructor_notes"
        )
        .eq("roll_number", roll)
        .order("submitted_at", desc=True)
        .limit(20)
        .execute()
    )

    if resp.data is None:
        raise HTTPException(status_code=500, detail="Database error")

    return {"data": resp.data}
