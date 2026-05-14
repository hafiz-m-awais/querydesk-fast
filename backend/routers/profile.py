"""
GET   /profile   — fetch current user's profile
PATCH /profile   — update profile fields
"""
from typing import Annotated
from fastapi import APIRouter, Depends
from supabase import create_client, Client
from datetime import datetime, timezone

from config import get_settings, Settings
from deps import get_current_profile
from models import UpdateProfileBody

router = APIRouter(prefix="/profile", tags=["profile"])


def _authed_client(token: str, settings: Settings) -> Client:
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.auth.set_session(token, "")
    return client


@router.get("")
async def get_profile(
    auth: Annotated[dict, Depends(get_current_profile)],
):
    return {"data": auth["profile"]}


@router.patch("")
async def update_profile(
    body: UpdateProfileBody,
    auth: Annotated[dict, Depends(get_current_profile)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    user     = auth["user"]
    token    = auth["token"]
    supabase = _authed_client(token, settings)

    update_data = body.model_dump(exclude_none=True)
    # Convert UUID objects to str for JSON serialisation
    for k, v in update_data.items():
        if hasattr(v, "hex"):          # UUID
            update_data[k] = str(v)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    resp = supabase.table("profiles").update(update_data).eq("id", user.id).execute()
    if not resp.data:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Profile update failed.")

    return {"message": "Profile updated."}
