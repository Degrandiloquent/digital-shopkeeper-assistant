from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db_session

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    """Is the service up? Does not touch the database, so it answers even while the database wakes up."""
    return {"status": "ok", "message": "service healthy"}


@router.get("/ready")
async def readiness(db: AsyncSession = Depends(get_db_session)) -> dict:
    """Can the service reach its database?"""
    await db.execute(text("SELECT 1"))
    return {"status": "ready", "database": "reachable"}
