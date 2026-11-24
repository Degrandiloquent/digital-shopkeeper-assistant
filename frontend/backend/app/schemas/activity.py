from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ActivityOut(BaseModel):
    id: UUID
    created_at: datetime
    actor_name: str | None
    action: str
    entity_type: str
    summary: str


class ActivityListResponse(BaseModel):
    items: list[ActivityOut]
