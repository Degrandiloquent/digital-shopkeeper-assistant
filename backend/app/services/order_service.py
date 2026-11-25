from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.models import Order, OrderStatus
from app.schemas.order import OrderCreate


async def create_order(db: AsyncSession, payload: OrderCreate) -> Order:
    total_price_cents = sum(item.price_cents * item.quantity for item in payload.items)
    order = Order(
        customer_name=payload.customer_name.strip(),
        customer_phone=payload.customer_phone.strip(),
        items=[item.model_dump() for item in payload.items],
        total_price_cents=total_price_cents,
        status=OrderStatus.PENDING,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


async def get_order(db: AsyncSession, order_id: UUID) -> Order:
    order = await db.get(Order, order_id)
    if order is None:
        raise NotFound("Order not found.")
    return order


async def list_pending_orders(db: AsyncSession) -> list[Order]:
    result = await db.execute(
        select(Order).where(Order.status == OrderStatus.PENDING).order_by(Order.created_at.asc())
    )
    return list(result.scalars().all())


async def mark_order_done(db: AsyncSession, order_id: UUID) -> Order:
    order = await get_order(db, order_id)
    order.status = OrderStatus.DONE
    await db.commit()
    await db.refresh(order)
    return order
