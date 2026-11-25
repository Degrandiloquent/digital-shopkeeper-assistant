from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import Permission
from app.database.session import get_db_session
from app.schemas.order import OrderCreate, OrderOut
from app.security.dependencies import AuthContext, require_permission
from app.services import order_service

router = APIRouter()


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def place_order(
    payload: OrderCreate,
    db: AsyncSession = Depends(get_db_session),
) -> OrderOut:
    """Place a food order. Public — no authentication required."""
    order = await order_service.create_order(db, payload)
    return OrderOut.model_validate(order)


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> OrderOut:
    """Get the status of a single order. Public — no authentication required."""
    order = await order_service.get_order(db, order_id)
    return OrderOut.model_validate(order)


@router.get("", response_model=list[OrderOut])
async def list_pending_orders(
    ctx: AuthContext = Depends(require_permission(Permission.DASHBOARD_VIEW)),
    db: AsyncSession = Depends(get_db_session),
) -> list[OrderOut]:
    """List all pending orders, oldest first. Requires dashboard.view permission."""
    orders = await order_service.list_pending_orders(db)
    return [OrderOut.model_validate(o) for o in orders]


@router.patch("/{order_id}/done", response_model=OrderOut)
async def mark_order_done(
    order_id: UUID,
    ctx: AuthContext = Depends(require_permission(Permission.DASHBOARD_VIEW)),
    db: AsyncSession = Depends(get_db_session),
) -> OrderOut:
    """Mark an order as done. Requires dashboard.view permission."""
    order = await order_service.mark_order_done(db, order_id)
    return OrderOut.model_validate(order)
