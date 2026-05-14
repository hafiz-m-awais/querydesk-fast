"""GET /attachment/{path} — returns a 5-minute signed URL for a private attachment"""
from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from supabase import create_client
from typing import Annotated

from config import get_settings, Settings
from deps import get_current_profile

router = APIRouter(prefix="/attachment", tags=["attachment"])


@router.get("/{file_path:path}")
async def get_attachment(
    file_path: str,
    auth: Annotated[dict, Depends(get_current_profile)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    admin = create_client(settings.supabase_url, settings.supabase_service_role_key)
    resp  = admin.storage.from_("query-attachments").create_signed_url(file_path, 300)

    if not resp or not resp.get("signedURL"):
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Could not generate download link")

    return RedirectResponse(url=resp["signedURL"])
