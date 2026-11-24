from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import Permission
from app.database.session import get_db_session
from app.schemas.business import AnnouncementCreate, AnnouncementOut, AnnouncementUpdate
from app.security.dependencies import AuthContext, require_permission
from app.services import business_service

router = APIRouter()


@router.get("", response_model=list[AnnouncementOut])
async def list_announcements(
    ctx: AuthContext = Depends(require_permission(Permission.ANNOUNCEMENTS_MANAGE)),
    db: AsyncSession = Depends(get_db_session),
) -> list[AnnouncementOut]:
    return await business_service.list_announcements(db, ctx)


@router.post("", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    payload: AnnouncementCreate,
    ctx: AuthContext = Depends(require_permission(Permission.ANNOUNCEMENTS_MANAGE)),
    db: AsyncSession = Depends(get_db_session),
) -> AnnouncementOut:
    return await business_service.create_announcement(db, ctx, payload)


@router.patch("/{announcement_id}", response_model=AnnouncementOut)
async def update_announcement(
    announcement_id: UUID,
    payload: AnnouncementUpdate,
    ctx: AuthContext = Depends(require_permission(Permission.ANNOUNCEMENTS_MANAGE)),
    db: AsyncSession = Depends(get_db_session),
) -> AnnouncementOut:
    return await business_service.update_announcement(db, ctx, announcement_id, payload)


@router.post("/{announcement_id}/end", response_model=AnnouncementOut)
async def end_announcement(
    announcement_id: UUID,
    ctx: AuthContext = Depends(require_permission(Permission.ANNOUNCEMENTS_MANAGE)),
    db: AsyncSession = Depends(get_db_session),
) -> AnnouncementOut:
    return await business_service.end_announcement(db, ctx, announcement_id)
