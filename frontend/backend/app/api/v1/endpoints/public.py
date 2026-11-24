from fastapi import APIRouter, Depends, Path, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.database.session import get_db_session
from app.schemas.public import PublicShop
from app.services import public_service

router = APIRouter()


@router.get("/business/{slug}", response_model=PublicShop)
async def public_business(
    response: Response,
    slug: str = Path(min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9-]+$"),
    db: AsyncSession = Depends(get_db_session),
) -> PublicShop:
    """No sign-in. Customer-safe information only."""
    response.headers["Cache-Control"] = f"public, max-age={get_settings().public_cache_seconds}"
    return await public_service.build_public_shop(db, slug)
