from datetime import datetime

from pydantic import BaseModel

from app.models import AnnouncementTone, ShopStatus
from app.schemas.business import DayHours, OpeningHours


class PublicAnnouncement(BaseModel):
    title: str
    body: str
    tone: AnnouncementTone
    expires_at: datetime | None


class PublicProduct(BaseModel):
    """Everything a customer needs, and nothing more: no counts, no ids, no sales."""

    name: str
    category: str
    price_cents: int
    availability: str  # in_stock | low_stock | out_of_stock


class PublicShop(BaseModel):
    slug: str
    name: str
    area_label: str
    status: ShopStatus
    status_message: str | None
    hours: OpeningHours
    today_key: str
    today: DayHours
    contact_note: str | None
    announcement: PublicAnnouncement | None
    products: list[PublicProduct]
    categories: list[str]
    updated_at: datetime
    generated_at: datetime
