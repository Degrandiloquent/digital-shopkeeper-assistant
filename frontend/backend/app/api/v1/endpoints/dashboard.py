from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import Permission
from app.database.session import get_db_session
from app.schemas.dashboard import DashboardSummary
from app.security.dependencies import AuthContext, require_permission
from app.services import dashboard_service

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
async def summary(
    ctx: AuthContext = Depends(require_permission(Permission.DASHBOARD_VIEW)),
    db: AsyncSession = Depends(get_db_session),
) -> DashboardSummary:
    return await dashboard_service.build_summary(db, ctx)
