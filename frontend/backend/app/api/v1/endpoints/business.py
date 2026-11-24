from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import Permission
from app.database.session import get_db_session
from app.schemas.business import BusinessOut, ProfileUpdate, StatusUpdate
from app.security.dependencies import AuthContext, require_permission
from app.services import business_service

router = APIRouter()


@router.get("", response_model=BusinessOut)
async def get_business(ctx: AuthContext = Depends(require_permission(Permission.BUSINESS_VIEW))) -> BusinessOut:
    return BusinessOut.model_validate(ctx.business)


@router.patch("/status", response_model=BusinessOut)
async def update_status(
    payload: StatusUpdate,
    ctx: AuthContext = Depends(require_permission(Permission.BUSINESS_MANAGE)),
    db: AsyncSession = Depends(get_db_session),
) -> BusinessOut:
    return BusinessOut.model_validate(await business_service.update_status(db, ctx, payload))


@router.patch("/profile", response_model=BusinessOut)
async def update_profile(
    payload: ProfileUpdate,
    ctx: AuthContext = Depends(require_permission(Permission.BUSINESS_MANAGE)),
    db: AsyncSession = Depends(get_db_session),
) -> BusinessOut:
    return BusinessOut.model_validate(await business_service.update_profile(db, ctx, payload))
