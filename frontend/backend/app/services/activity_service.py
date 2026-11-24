from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models import AuditLog
from app.schemas.activity import ActivityListResponse, ActivityOut
from app.security.dependencies import AuthContext


async def list_activity(db: AsyncSession, ctx: AuthContext, limit: int) -> ActivityListResponse:
    rows = (
        (
            await db.execute(
                select(AuditLog)
                .where(AuditLog.business_id == ctx.business_id)
                .options(joinedload(AuditLog.actor))
                .order_by(AuditLog.created_at.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return ActivityListResponse(
        items=[
            ActivityOut(
                id=row.id,
                created_at=row.created_at,
                actor_name=row.actor.name if row.actor else None,
                action=row.action,
                entity_type=row.entity_type,
                summary=row.summary,
            )
            for row in rows
        ]
    )
