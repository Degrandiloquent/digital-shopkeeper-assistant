from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.errors import Conflict, NotFound
from app.core.permissions import Permission
from app.models import Product, Sale, SaleItem, StockMovement, StockReason
from app.schemas.sale import (
    MAX_LINE_QUANTITY,
    Period,
    SaleCreate,
    SaleItemOut,
    SaleListResponse,
    SaleOut,
)
from app.security.dependencies import AuthContext
from app.services.stock import product_stock_state
from app.services.timeutil import get_tz, start_of_local_day_utc


def sale_to_out(
    sale: Sale,
    cashier_name: str,
    *,
    products_after: dict[UUID, Product] | None = None,
    replayed: bool = False,
) -> SaleOut:
    items = []
    for item in sale.items:
        after = products_after.get(item.product_id) if products_after else None
        items.append(
            SaleItemOut(
                product_id=item.product_id,
                product_name=item.product_name,
                quantity=item.quantity,
                unit_price_cents=item.unit_price_cents,
                line_total_cents=item.line_total_cents,
                stock_after=after.stock_qty if after else None,
                stock_state=product_stock_state(after) if after else None,
            )
        )
    return SaleOut(
        id=sale.id,
        created_at=sale.created_at,
        total_cents=sale.total_cents,
        unit_count=sale.unit_count,
        cashier_name=cashier_name,
        items=items,
        replayed=replayed,
    )


async def _find_by_client_ref(db: AsyncSession, business_id: UUID, client_ref: str) -> Sale | None:
    return (
        await db.execute(
            select(Sale)
            .where(Sale.business_id == business_id, Sale.client_ref == client_ref)
            .options(selectinload(Sale.items), joinedload(Sale.user))
        )
    ).scalar_one_or_none()


async def create_sale(db: AsyncSession, ctx: AuthContext, payload: SaleCreate) -> SaleOut:
    """Record a sale and take the stock off the shelf in ONE database transaction.

    - The product rows are locked (in a fixed order, so two sales can never deadlock) before any count is
      read. Two people selling the last loaf at the same moment: the second one waits, then sees zero and
      is refused.
    - Every line is checked before anything changes. If one line is short, the whole sale is refused and
      no stock moves.
    - A retry carrying the same client_ref returns the sale already recorded instead of recording another.
    """
    business_id = ctx.business_id

    if payload.client_ref:
        existing = await _find_by_client_ref(db, business_id, payload.client_ref)
        if existing is not None:
            return sale_to_out(existing, existing.user.name, replayed=True)

    # Two lines for the same product become one line.
    wanted: dict[UUID, int] = {}
    for line in payload.items:
        wanted[line.product_id] = wanted.get(line.product_id, 0) + line.quantity
    if any(quantity > MAX_LINE_QUANTITY for quantity in wanted.values()):
        raise Conflict(
            f"You can sell at most {MAX_LINE_QUANTITY} of one product at a time.", code="quantity_too_large"
        )

    ids = sorted(wanted)
    rows = (
        (
            await db.execute(
                select(Product)
                .where(Product.id.in_(ids), Product.business_id == business_id)
                .order_by(Product.id)
                .with_for_update()
            )
        )
        .scalars()
        .all()
    )
    found = {product.id: product for product in rows}

    if len(found) != len(ids):
        raise NotFound("A product in this sale no longer exists. Refresh the list and try again.", code="product_not_found")

    archived = [product for product in rows if not product.is_active]
    if archived:
        names = ", ".join(f"“{product.name}”" for product in archived)
        raise Conflict(
            f"{names} {'is' if len(archived) == 1 else 'are'} archived and cannot be sold.",
            code="product_unavailable",
            details=[{"product_id": str(product.id), "product_name": product.name} for product in archived],
        )

    shortages = [
        {
            "product_id": str(product.id),
            "product_name": product.name,
            "requested": wanted[product.id],
            "available": product.stock_qty,
        }
        for product in rows
        if wanted[product.id] > product.stock_qty
    ]
    if shortages:
        message = "Not enough stock: " + "; ".join(
            f"{s['product_name']} has {s['available']} left, you asked for {s['requested']}" for s in shortages
        )
        raise Conflict(message + ".", code="insufficient_stock", details=shortages)

    sale = Sale(
        id=uuid4(),
        business_id=business_id,
        user_id=ctx.user.id,
        client_ref=payload.client_ref,
        total_cents=0,
        unit_count=0,
    )
    total_cents = 0
    unit_count = 0
    movements: list[StockMovement] = []
    for product_id in ids:
        product = found[product_id]
        quantity = wanted[product_id]
        line_total = product.price_cents * quantity
        sale.items.append(
            SaleItem(
                product_id=product.id,
                product_name=product.name,
                quantity=quantity,
                unit_price_cents=product.price_cents,
                line_total_cents=line_total,
            )
        )
        product.stock_qty -= quantity
        total_cents += line_total
        unit_count += quantity
        movements.append(
            StockMovement(
                business_id=business_id,
                product_id=product.id,
                user_id=ctx.user.id,
                sale_id=sale.id,
                delta=-quantity,
                quantity_after=product.stock_qty,
                reason=StockReason.SALE,
            )
        )
    sale.total_cents = total_cents
    sale.unit_count = unit_count

    try:
        db.add(sale)
        await db.flush()
    except IntegrityError:
        await db.rollback()
        if payload.client_ref:
            existing = await _find_by_client_ref(db, business_id, payload.client_ref)
            if existing is not None:
                return sale_to_out(existing, existing.user.name, replayed=True)
        raise

    db.add_all(movements)
    try:
        await db.commit()
    except IntegrityError:
        # The database itself refuses a negative stock count. Reaching this means something changed the
        # stock outside the lock; refuse the sale rather than record a wrong count.
        await db.rollback()
        raise Conflict("Stock changed while recording this sale. Check the count and try again.", code="insufficient_stock") from None

    return sale_to_out(sale, ctx.user.name, products_after=found)


def period_start(period: Period, timezone_name: str):
    tz = get_tz(timezone_name)
    if period == "today":
        return start_of_local_day_utc(tz)
    if period == "7d":
        return start_of_local_day_utc(tz, days_ago=6)
    if period == "30d":
        return start_of_local_day_utc(tz, days_ago=29)
    return None


async def list_sales(
    db: AsyncSession, ctx: AuthContext, *, period: Period, limit: int, offset: int
) -> SaleListResponse:
    """Owners see every sale in the shop. Staff see only the sales they recorded themselves."""
    conditions = [Sale.business_id == ctx.business_id]
    if not ctx.can(Permission.SALES_VIEW_ALL):
        conditions.append(Sale.user_id == ctx.user.id)
    start = period_start(period, ctx.business.timezone)
    if start is not None:
        conditions.append(Sale.created_at >= start)

    count, total = (
        await db.execute(select(func.count(Sale.id), func.coalesce(func.sum(Sale.total_cents), 0)).where(*conditions))
    ).one()

    sales = (
        (
            await db.execute(
                select(Sale)
                .where(*conditions)
                .options(selectinload(Sale.items), joinedload(Sale.user))
                .order_by(Sale.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return SaleListResponse(
        items=[sale_to_out(sale, sale.user.name) for sale in sales],
        sale_count=int(count),
        total_cents=int(total),
        period=period,
    )
