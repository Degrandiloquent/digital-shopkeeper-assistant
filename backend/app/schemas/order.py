from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints

from app.schemas.common import StrictModel, Text120

Text30 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]


class OrderItemIn(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    quantity: int = Field(ge=1, le=20)
    price_cents: int = Field(ge=0)
    category: str = Field(min_length=1, max_length=80)


class OrderCreate(StrictModel):
    customer_name: Text120
    customer_phone: Text30
    items: list[OrderItemIn] = Field(min_length=1, max_length=20)


class OrderOut(BaseModel):
    id: UUID
    customer_name: str
    customer_phone: str
    items: list[dict]
    total_price_cents: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
