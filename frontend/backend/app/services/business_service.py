from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainValidationError, NotFound
from app.models import Announcement, utcnow
from app.schemas.business import (
    AnnouncementCreate,
    AnnouncementOut,
    AnnouncementUpdate,
    ProfileUpdate,
    StatusUpdate,
)
from app.security.dependencies import AuthContext
from app.services.audit import record_audit

STATUS_LABELS = {
    "open": "Open",
    "closed": "Closed",
    "temporarily_unavailable": "Temporarily unavailable",
}


async def update_status(db: AsyncSession, ctx: AuthContext, payload: StatusUpdate):
    business = ctx.business
    business.status = payload.status
    business.status_message = payload.status_message or None
    business.status_updated_at = utcnow()
    label = STATUS_LABELS[payload.status.value]
    note = f" Message: “{business.status_message}”." if business.status_message else ""
    record_audit(
        db,
        ctx,
        "business.status_changed",
        "business",
        business.id,
        f"Set the shop to {label}.{note}",
        metadata={"status": payload.status.value, "message": business.status_message},
    )
    await db.commit()
    return business


async def update_profile(db: AsyncSession, ctx: AuthContext, payload: ProfileUpdate):
    business = ctx.business
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if field == "contact_note":
            value = value or None
        setattr(business, field, value)
    record_audit(
        db,
        ctx,
        "business.profile_updated",
        "business",
        business.id,
        f"Updated shop details ({', '.join(sorted(changes))}).",
        metadata={"fields": sorted(changes)},
    )
    await db.commit()
    return business


def announcement_state(announcement: Announcement, now: datetime | None = None) -> str:
    now = now or datetime.now(UTC)
    if not announcement.is_active:
        return "ended"
    if announcement.expires_at is not None and announcement.expires_at <= now:
        return "expired"
    if announcement.active_from > now:
        return "scheduled"
    return "live"


def announcement_to_out(announcement: Announcement) -> AnnouncementOut:
    out = AnnouncementOut.model_validate(announcement)
    out.state = announcement_state(announcement)
    return out


async def _get_announcement(db: AsyncSession, business_id: UUID, announcement_id: UUID) -> Announcement:
    announcement = (
        await db.execute(
            select(Announcement).where(Announcement.id == announcement_id, Announcement.business_id == business_id)
        )
    ).scalar_one_or_none()
    if announcement is None:
        raise NotFound("Announcement not found.")
    return announcement


def _require_future(expires_at: datetime | None) -> datetime | None:
    if expires_at is None:
        return None
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at <= datetime.now(UTC):
        raise DomainValidationError("The end time must be in the future.")
    return expires_at


async def list_announcements(db: AsyncSession, ctx: AuthContext) -> list[AnnouncementOut]:
    rows = (
        (
            await db.execute(
                select(Announcement)
                .where(Announcement.business_id == ctx.business_id)
                .order_by(Announcement.created_at.desc())
                .limit(50)
            )
        )
        .scalars()
        .all()
    )
    return [announcement_to_out(row) for row in rows]


async def create_announcement(db: AsyncSession, ctx: AuthContext, payload: AnnouncementCreate) -> AnnouncementOut:
    announcement = Announcement(
        business_id=ctx.business_id,
        title=payload.title,
        body=payload.body,
        tone=payload.tone,
        expires_at=_require_future(payload.expires_at),
        created_by=ctx.user.id,
    )
    db.add(announcement)
    await db.flush()
    record_audit(
        db, ctx, "announcement.created", "announcement", announcement.id, f"Published announcement “{announcement.title}”."
    )
    await db.commit()
    return announcement_to_out(announcement)


async def update_announcement(
    db: AsyncSession, ctx: AuthContext, announcement_id: UUID, payload: AnnouncementUpdate
) -> AnnouncementOut:
    announcement = await _get_announcement(db, ctx.business_id, announcement_id)
    changes = payload.model_dump(exclude_unset=True)
    if "expires_at" in changes:
        changes["expires_at"] = _require_future(changes["expires_at"])
    for field, value in changes.items():
        setattr(announcement, field, value)
    record_audit(
        db, ctx, "announcement.updated", "announcement", announcement.id, f"Edited announcement “{announcement.title}”."
    )
    await db.commit()
    return announcement_to_out(announcement)


async def end_announcement(db: AsyncSession, ctx: AuthContext, announcement_id: UUID) -> AnnouncementOut:
    announcement = await _get_announcement(db, ctx.business_id, announcement_id)
    if announcement.is_active:
        announcement.is_active = False
        record_audit(
            db, ctx, "announcement.ended", "announcement", announcement.id, f"Ended announcement “{announcement.title}”."
        )
        await db.commit()
    return announcement_to_out(announcement)
