from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import Permission
from app.database.session import get_db_session
from app.schemas.activity import ActivityListResponse
from app.security.dependencies import AuthContext, require_permission
from app.services import activity_service

router = APIRouter()


@router.get("", response_model=ActivityListResponse)
async def list_activity(
    limit: int = Query(default=50, ge=1, le=200),
    ctx: AuthContext = Depends(require_permission(Permission.ACTIVITY_VIEW)),
    db: AsyncSession = Depends(get_db_session),
) -> ActivityListResponse:
    return await activity_service.list_activity(db, ctx, limit)
