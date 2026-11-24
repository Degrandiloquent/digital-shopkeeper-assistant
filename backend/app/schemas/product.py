from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import Field, computed_field, model_validator

from app.schemas.common import Note140, ORMModel, StrictModel, Text40, Text80
from app.services.stock import stock_state

MAX_PRICE_CENTS = 10_000_000  # R100,000: a typo guard, not a business rule.
MAX_STOCK = 100_000


class ProductCreate(StrictModel):
    name: Text80
    category: Text40
    price_cents: int = Field(ge=0, le=MAX_PRICE_CENTS)
    stock_qty: int = Field(default=0, ge=0, le=MAX_STOCK)
    low_stock_threshold: int = Field(default=5, ge=0, le=MAX_STOCK)
    is_featured: bool = True


class ProductUpdate(StrictModel):
    # Stock is deliberately not editable here: counts change through sales and stock adjustments, which keep a
    # record of who changed what and why.
    name: Text80 | None = None
    category: Text40 | None = None
    price_cents: int | None = Field(default=None, ge=0, le=MAX_PRICE_CENTS)
    low_stock_threshold: int | None = Field(default=None, ge=0, le=MAX_STOCK)
    is_featured: bool | None = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> "ProductUpdate":
        if not self.model_fields_set:
            raise ValueError("Send at least one field to change.")
        for field in ("name", "category", "price_cents", "low_stock_threshold", "is_featured"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be empty.")
        return self


class AdjustmentReason(str, Enum):
    RESTOCK = "restock"
    CORRECTION = "correction"
    DAMAGED = "damaged"


class StockAdjustmentCreate(StrictModel):
    delta: int = Field(ge=-MAX_STOCK, le=MAX_STOCK)
    reason: AdjustmentReason
    note: Note140 | None = None

    @model_validator(mode="after")
    def delta_not_zero(self) -> "StockAdjustmentCreate":
        if self.delta == 0:
            raise ValueError("The change in stock cannot be zero.")
        return self


class ProductOut(ORMModel):
    id: UUID
    name: str
    category: str
    price_cents: int
    stock_qty: int
    low_stock_threshold: int
    is_active: bool
    is_featured: bool
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def stock_state(self) -> str:
        return stock_state(self.stock_qty, self.low_stock_threshold)
