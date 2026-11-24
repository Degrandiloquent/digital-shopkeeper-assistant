from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import Permission
from app.database.session import get_db_session
from app.schemas.sale import Period, SaleCreate, SaleListResponse, SaleOut
from app.security.dependencies import AuthContext, require_permission
from app.services import sale_service

router = APIRouter()


@router.post("", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
async def create_sale(
    payload: SaleCreate,
    response: Response,
    ctx: AuthContext = Depends(require_permission(Permission.SALES_CREATE)),
    db: AsyncSession = Depends(get_db_session),
) -> SaleOut:
    """Record a sale. Returns 409 when any line asks for more than is in stock, and changes nothing."""
    sale = await sale_service.create_sale(db, ctx, payload)
    if sale.replayed:
        response.status_code = status.HTTP_200_OK
    return sale


@router.get("", response_model=SaleListResponse)
async def list_sales(
    period: Period = "today",
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    ctx: AuthContext = Depends(require_permission(Permission.SALES_VIEW_OWN)),
    db: AsyncSession = Depends(get_db_session),
) -> SaleListResponse:
    return await sale_service.list_sales(db, ctx, period=period, limit=limit, offset=offset)
