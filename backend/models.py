from typing import Any
from pydantic import BaseModel, UUID4, Field, field_validator
import re

# ── Constants ────────────────────────────────────────────────────
QUERY_TYPES = ["attendance", "marks", "assignment", "project", "final", "other"]
QUERY_STATUSES = ["pending", "reviewing", "resolved", "rejected", "escalated"]
ROLL_NUMBER_RE = re.compile(r"^\d{2}[A-Za-z]-\d{4}$")
DESCRIPTION_MIN = 10
DESCRIPTION_MAX = 2000
MAX_ATTACHMENT_MB = 5
MAX_SUBMISSIONS_PER_HOUR = 5
ALLOWED_MIMES = [
    "image/jpeg", "image/png", "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
]


# ── Request bodies ───────────────────────────────────────────────

class AttachmentPayload(BaseModel):
    name: str = Field(max_length=255)
    mime: str
    data: str          # base64-encoded
    size: int = Field(ge=0)


class SubmitQueryBody(BaseModel):
    course_id:      UUID4
    query_type:     str
    description:    str = Field(min_length=DESCRIPTION_MIN, max_length=DESCRIPTION_MAX)
    session_number: str | None = Field(default=None, max_length=100)
    session_date:   str | None = None
    extra_date:     str | None = None
    marks_awarded:  float | None = Field(default=None, ge=0, le=1000)
    marks_expected: float | None = Field(default=None, ge=0, le=1000)
    issue_reason:   str | None = Field(default=None, max_length=500)
    request_type:   str | None = Field(default=None, max_length=100)
    is_urgent:      bool = False
    attachment:     AttachmentPayload | None = None

    @field_validator("query_type")
    @classmethod
    def validate_query_type(cls, v: str) -> str:
        if v not in QUERY_TYPES:
            raise ValueError(f"query_type must be one of {QUERY_TYPES}")
        return v


class UpdateStatusBody(BaseModel):
    status:           str
    instructor_notes: str | None = Field(default=None, max_length=1000)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in QUERY_STATUSES:
            raise ValueError(f"status must be one of {QUERY_STATUSES}")
        return v


class BulkUpdateBody(BaseModel):
    query_ids: list[UUID4] = Field(min_length=1)
    status:    str
    notes:     str | None = Field(default=None, max_length=1000)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in QUERY_STATUSES:
            raise ValueError(f"status must be one of {QUERY_STATUSES}")
        return v


class UpdateProfileBody(BaseModel):
    full_name:     str | None = Field(default=None, min_length=2, max_length=100)
    roll_number:   str | None = None
    campus_id:     UUID4 | None = None
    department_id: UUID4 | None = None
    batch_year:    int | None = Field(default=None, ge=2000, le=2099)

    @field_validator("roll_number")
    @classmethod
    def validate_roll(cls, v: str | None) -> str | None:
        if v is not None and not ROLL_NUMBER_RE.match(v):
            raise ValueError("Format: 23I-1234")
        return v


# ── Generic API response ─────────────────────────────────────────

class ApiResponse(BaseModel):
    data: Any = None
    message: str | None = None
    error: str | None = None
    total: int | None = None
    page: int | None = None
    limit: int | None = None
