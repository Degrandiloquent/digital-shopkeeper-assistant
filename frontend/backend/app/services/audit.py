from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog
from app.security.dependencies import AuthContext


def record_audit(
    db: AsyncSession,
    ctx: AuthContext,
    action: str,
    entity_type: str,
    entity_id: object | None,
    summary: str,
    metadata: dict | None = None,
    source_ip: str | None = None,
) -> None:
    """Queue an audit entry in the caller's transaction, so it is saved (or rolled back) together with the
    change it describes."""
    db.add(
        AuditLog(
            business_id=ctx.business_id,
            actor_user_id=ctx.user.id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            summary=summary[:240],
            metadata_json=metadata,
            source_ip=source_ip,
        )
    )
