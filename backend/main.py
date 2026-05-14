"""
QueryDesk FastAPI backend
Replaces Next.js /api/* routes.

Start:
    uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from routers import queries, bulk, stats, courses, profile, track, attachment

settings = get_settings()

app = FastAPI(
    title="QueryDesk API",
    description="Backend API for QueryDesk — FAST-NUCES student query management system",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────
# bulk must be registered BEFORE queries so /queries/bulk is not
# shadowed by /queries/{query_id}
app.include_router(bulk.router)
app.include_router(queries.router)
app.include_router(stats.router)
app.include_router(courses.router)
app.include_router(profile.router)
app.include_router(track.router)
app.include_router(attachment.router)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "service": "QueryDesk API"}
