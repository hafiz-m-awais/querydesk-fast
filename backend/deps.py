from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import create_client, Client
from config import get_settings, Settings

bearer_scheme = HTTPBearer()


def get_supabase(settings: Annotated[Settings, Depends(get_settings)]) -> Client:
    """Anon Supabase client — respects RLS."""
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def get_admin_supabase(settings: Annotated[Settings, Depends(get_settings)]) -> Client:
    """Service-role Supabase client — bypasses RLS. Use only in trusted server code."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    """
    Verify the Supabase JWT passed as Bearer token.
    Returns the Supabase user dict on success.
    """
    token = credentials.credentials
    # Use a fresh client that carries the user's JWT so RLS kicks in correctly
    client: Client = create_client(settings.supabase_url, settings.supabase_anon_key)
    response = client.auth.get_user(token)
    if not response or not response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"user": response.user, "token": token}


async def get_current_profile(
    auth: Annotated[dict, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    """Verify token AND fetch the profile row from DB."""
    user = auth["user"]
    token = auth["token"]

    # Use authed client so RLS applies
    client: Client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.auth.set_session(token, "")

    resp = (
        client.table("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=403, detail="Profile not found")

    return {"user": user, "profile": resp.data, "token": token}
