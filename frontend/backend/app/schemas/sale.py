from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import StrictModel

MAX_LINE_QUANTITY = 999


class SaleItemIn(StrictModel):
    product_id: UUID
    quantity: int = Field(ge=1, le=MAX_LINE_QUANTITY)


class SaleCreate(StrictModel):
    items: list[SaleItemIn] = Field(min_length=1, max_length=50)
    client_ref: str | None = Field(default=None, min_length=8, max_length=64)

    @field_validator("client_ref")
    @classmethod
    def printable_ref(cls, value: str | None) -> str | None:
        if value is not None and not value.replace("-", "").replace("_", "").isalnum():
            raise ValueError("client_ref may only contain letters, digits, hyphens and underscores.")
        return value


class SaleItemOut(BaseModel):
    product_id: UUID
    product_name: str
    quantity: int
    unit_price_cents: int
    line_total_cents: int
    # Only filled in on the response to a new sale: the count and state the product ended up with.
    stock_after: int | None = None
    stock_state: str | None = None


class SaleOut(BaseModel):
    id: UUID
    created_at: datetime
    total_cents: int
    unit_count: int
    cashier_name: str
    items: list[SaleItemOut]
    # True when this response is a repeat of a sale already recorded with the same client_ref.
    replayed: bool = False


Period = Literal["today", "7d", "30d", "all"]


class SaleListResponse(BaseModel):
    items: list[SaleOut]
    sale_count: int
    total_cents: int
    period: Period
