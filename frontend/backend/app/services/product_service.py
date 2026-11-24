from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict, NotFound
from app.models import Product, StockMovement, StockReason
from app.schemas.product import ProductCreate, ProductUpdate, StockAdjustmentCreate
from app.security.dependencies import AuthContext
from app.services.audit import record_audit


async def get_product(db: AsyncSession, business_id: UUID, product_id: UUID, *, lock: bool = False) -> Product:
    stmt = select(Product).where(Product.id == product_id, Product.business_id == business_id)
    if lock:
        stmt = stmt.with_for_update()
    product = (await db.execute(stmt)).scalar_one_or_none()
    if product is None:
        raise NotFound("Product not found.")
    return product


async def list_products(
    db: AsyncSession,
    business_id: UUID,
    *,
    include_archived: bool = False,
    query: str | None = None,
    category: str | None = None,
) -> list[Product]:
    stmt = select(Product).where(Product.business_id == business_id)
    if not include_archived:
        stmt = stmt.where(Product.is_active.is_(True))
    if query:
        stmt = stmt.where(func.lower(Product.name).contains(query.strip().lower()))
    if category:
        stmt = stmt.where(Product.category == category)
    stmt = stmt.order_by(Product.is_active.desc(), Product.category, Product.name)
    return list((await db.execute(stmt)).scalars().all())


async def _ensure_name_free(
    db: AsyncSession, business_id: UUID, name: str, *, ignore_id: UUID | None = None
) -> None:
    stmt = select(Product.id).where(
        Product.business_id == business_id, func.lower(Product.name) == name.strip().lower()
    )
    if ignore_id is not None:
        stmt = stmt.where(Product.id != ignore_id)
    if (await db.execute(stmt)).first() is not None:
        raise Conflict("A product with this name already exists.", code="duplicate_name")


async def create_product(db: AsyncSession, ctx: AuthContext, payload: ProductCreate) -> Product:
    await _ensure_name_free(db, ctx.business_id, payload.name)
    product = Product(business_id=ctx.business_id, **payload.model_dump())
    db.add(product)
    await db.flush()
    if product.stock_qty > 0:
        db.add(
            StockMovement(
                business_id=ctx.business_id,
                product_id=product.id,
                user_id=ctx.user.id,
                delta=product.stock_qty,
                quantity_after=product.stock_qty,
                reason=StockReason.INITIAL,
                note="Opening stock",
            )
        )
    record_audit(db, ctx, "product.created", "product", product.id, f"Added product “{product.name}”.")
    await db.commit()
    return product


async def update_product(db: AsyncSession, ctx: AuthContext, product_id: UUID, payload: ProductUpdate) -> Product:
    product = await get_product(db, ctx.business_id, product_id)
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes:
        await _ensure_name_free(db, ctx.business_id, changes["name"], ignore_id=product.id)
    for field, value in changes.items():
        setattr(product, field, value)
    record_audit(
        db,
        ctx,
        "product.updated",
        "product",
        product.id,
        f"Updated product “{product.name}” ({', '.join(sorted(changes))}).",
        metadata={"fields": sorted(changes)},
    )
    await db.commit()
    return product


async def set_product_active(db: AsyncSession, ctx: AuthContext, product_id: UUID, active: bool) -> Product:
    product = await get_product(db, ctx.business_id, product_id)
    if product.is_active != active:
        product.is_active = active
        verb = "Restored" if active else "Archived"
        record_audit(
            db,
            ctx,
            "product.restored" if active else "product.archived",
            "product",
            product.id,
            f"{verb} product “{product.name}”.",
        )
        await db.commit()
    return product


async def adjust_stock(
    db: AsyncSession, ctx: AuthContext, product_id: UUID, payload: StockAdjustmentCreate
) -> Product:
    # Lock the row so two adjustments (or an adjustment and a sale) can never overwrite each other.
    product = await get_product(db, ctx.business_id, product_id, lock=True)
    new_quantity = product.stock_qty + payload.delta
    if new_quantity < 0:
        raise Conflict(
            f"Only {product.stock_qty} of “{product.name}” in stock, so you cannot remove {abs(payload.delta)}.",
            code="stock_below_zero",
        )
    product.stock_qty = new_quantity
    db.add(
        StockMovement(
            business_id=ctx.business_id,
            product_id=product.id,
            user_id=ctx.user.id,
            delta=payload.delta,
            quantity_after=new_quantity,
            reason=StockReason(payload.reason.value),
            note=payload.note or None,
        )
    )
    sign = "+" if payload.delta > 0 else ""
    record_audit(
        db,
        ctx,
        "stock.adjusted",
        "product",
        product.id,
        f"Stock for “{product.name}” changed by {sign}{payload.delta} ({payload.reason.value}); now {new_quantity}.",
        metadata={"delta": payload.delta, "reason": payload.reason.value, "quantity_after": new_quantity},
    )
    await db.commit()
    return product
