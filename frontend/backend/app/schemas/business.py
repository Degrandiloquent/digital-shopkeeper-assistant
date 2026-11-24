import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, model_validator

from app.models import AnnouncementTone, ShopStatus
from app.schemas.common import Note140, ORMModel, StrictModel, Text80, Text120

DAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
_TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class DayHours(BaseModel):
    closed: bool = False
    open: str | None = None
    close: str | None = None

    @model_validator(mode="after")
    def valid_times(self) -> "DayHours":
        if self.closed:
            self.open = None
            self.close = None
            return self
        if not self.open or not self.close or not _TIME.match(self.open) or not _TIME.match(self.close):
            raise ValueError("Opening and closing times must look like 07:30.")
        if self.open >= self.close:
            raise ValueError("Closing time must be after opening time.")
        return self


class OpeningHours(BaseModel):
    mon: DayHours
    tue: DayHours
    wed: DayHours
    thu: DayHours
    fri: DayHours
    sat: DayHours
    sun: DayHours


class BusinessOut(ORMModel):
    id: UUID
    slug: str
    name: str
    area_label: str
    timezone: str
    hours: OpeningHours
    status: ShopStatus
    status_message: str | None
    contact_note: str | None
    status_updated_at: datetime


class StatusUpdate(StrictModel):
    status: ShopStatus
    status_message: Note140 | None = None


class ProfileUpdate(StrictModel):
    name: Text120 | None = None
    area_label: Text120 | None = None
    hours: OpeningHours | None = None
    contact_note: Note140 | None = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> "ProfileUpdate":
        if not self.model_fields_set:
            raise ValueError("Send at least one field to change.")
        return self


class AnnouncementCreate(StrictModel):
    title: Text80
    body: str = ""
    tone: AnnouncementTone = AnnouncementTone.INFO
    expires_at: datetime | None = None

    @model_validator(mode="after")
    def short_body(self) -> "AnnouncementCreate":
        self.body = self.body.strip()
        if len(self.body) > 280:
            raise ValueError("Message must be 280 characters or fewer.")
        return self


class AnnouncementUpdate(StrictModel):
    title: Text80 | None = None
    body: str | None = None
    tone: AnnouncementTone | None = None
    expires_at: datetime | None = None

    @model_validator(mode="after")
    def checks(self) -> "AnnouncementUpdate":
        if not self.model_fields_set:
            raise ValueError("Send at least one field to change.")
        if self.body is not None:
            self.body = self.body.strip()
            if len(self.body) > 280:
                raise ValueError("Message must be 280 characters or fewer.")
        return self


class AnnouncementOut(ORMModel):
    id: UUID
    title: str
    body: str
    tone: AnnouncementTone
    active_from: datetime
    expires_at: datetime | None
    is_active: bool
    created_at: datetime
    # live, scheduled, expired or ended: worked out when the announcement is read.
    state: str = "live"
