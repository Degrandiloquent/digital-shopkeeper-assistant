from __future__ import annotations

import enum
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.database.base import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class UTCDateTime(TypeDecorator):
    """Timestamps are always stored in UTC and always come back timezone-aware (SQLite drops the zone)."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value


def _enum(enum_class: type[enum.Enum]) -> Enum:
    # Stored as plain text (no PostgreSQL enum type) so adding a value never needs a risky migration.
    return Enum(
        enum_class,
        native_enum=False,
        length=32,
        values_callable=lambda members: [member.value for member in members],
    )


class ShopStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    TEMPORARILY_UNAVAILABLE = "temporarily_unavailable"


class UserRole(str, enum.Enum):
    OWNER = "owner"
    STAFF = "staff"


class StockReason(str, enum.Enum):
    INITIAL = "initial"
    SALE = "sale"
    RESTOCK = "restock"
    CORRECTION = "correction"
    DAMAGED = "damaged"


class AnnouncementTone(str, enum.Enum):
    INFO = "info"
    PROMO = "promo"
    WARNING = "warning"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow, nullable=False)


class Business(TimestampMixin, Base):
    """One shop. Every other table points at a business, so the schema is multi-business ready."""

    __tablename__ = "businesses"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # A general area, never a street address.
    area_label: Mapped[str] = mapped_column(String(120), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="Africa/Johannesburg", nullable=False)
    hours: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[ShopStatus] = mapped_column(_enum(ShopStatus), default=ShopStatus.OPEN, nullable=False)
    status_message: Mapped[str | None] = mapped_column(String(140))
    contact_note: Mapped[str | None] = mapped_column(String(200))
    status_updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    business_id: Mapped[UUID] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(_enum(UserRole), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


class RefreshToken(Base):
    """Only a hash of each refresh token is stored. Tokens rotate on every use."""

    __tablename__ = "refresh_tokens"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)


class Product(TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("business_id", "name", name="uq_products_business_name"),
        CheckConstraint("price_cents >= 0", name="ck_products_price_non_negative"),
        CheckConstraint("stock_qty >= 0", name="ck_products_stock_non_negative"),
        CheckConstraint("low_stock_threshold >= 0", name="ck_products_threshold_non_negative"),
        Index("ix_products_business_active", "business_id", "is_active"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    business_id: Mapped[UUID] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    # Money is stored as whole cents (ZAR). Integers never drift the way floats do.
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    stock_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Featured products are the ones customers see on the public page.
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Sale(Base):
    __tablename__ = "sales"
    __table_args__ = (
        UniqueConstraint("business_id", "client_ref", name="uq_sales_business_client_ref"),
        Index("ix_sales_business_created", "business_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    business_id: Mapped[UUID] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"))
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    total_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_count: Mapped[int] = mapped_column(Integer, nullable=False)
    # Sent by the browser so a retry after a dropped connection can never record the same sale twice.
    client_ref: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)

    items: Mapped[list[SaleItem]] = relationship(
        back_populates="sale", cascade="all, delete-orphan", order_by="SaleItem.product_name"
    )
    user: Mapped[User] = relationship()


class SaleItem(Base):
    __tablename__ = "sale_items"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_sale_items_quantity_positive"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    sale_id: Mapped[UUID] = mapped_column(ForeignKey("sales.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id"), index=True)
    # Name and price are copied at the moment of sale, so history never changes when a product is edited.
    product_name: Mapped[str] = mapped_column(String(80), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total_cents: Mapped[int] = mapped_column(Integer, nullable=False)

    sale: Mapped[Sale] = relationship(back_populates="items")


class StockMovement(Base):
    """A ledger of every stock change: why it happened, who did it and what the count became."""

    __tablename__ = "stock_movements"
    __table_args__ = (Index("ix_stock_movements_product_created", "product_id", "created_at"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    business_id: Mapped[UUID] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id"))
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    sale_id: Mapped[UUID | None] = mapped_column(ForeignKey("sales.id", ondelete="SET NULL"))
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_after: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[StockReason] = mapped_column(_enum(StockReason), nullable=False)
    note: Mapped[str | None] = mapped_column(String(140))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)


class Announcement(Base):
    __tablename__ = "announcements"
    __table_args__ = (Index("ix_announcements_business_created", "business_id", "created_at"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    business_id: Mapped[UUID] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    tone: Mapped[AnnouncementTone] = mapped_column(
        _enum(AnnouncementTone), default=AnnouncementTone.INFO, nullable=False
    )
    active_from: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)


class AuditLog(Base):
    """Who changed what, and when. Written for every owner action and every sign-in."""

    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_business_created", "business_id", "created_at"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    business_id: Mapped[UUID] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"))
    actor_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(64))
    summary: Mapped[str] = mapped_column(String(240), nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSON)
    source_ip: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)

    actor: Mapped[User | None] = relationship()
