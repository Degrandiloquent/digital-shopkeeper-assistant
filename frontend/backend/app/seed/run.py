"""Create the demo shop. Safe to run on every start: it only fills in what is missing.

    python -m app.seed.run            # add anything missing
    python -m app.seed.run --reset    # wipe the demo shop's data and rebuild it (never in production)
"""

import argparse
import asyncio
import logging
import random
import sys
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.database.session import AsyncSessionLocal
from app.models import (
    Announcement,
    AuditLog,
    Business,
    Product,
    RefreshToken,
    Sale,
    SaleItem,
    StockMovement,
    StockReason,
    User,
    UserRole,
)
from app.security.password import hash_password, validate_password_strength
from app.seed import demo_data
from app.services.timeutil import get_tz

logger = logging.getLogger("seed")


async def wipe_demo_business(db: AsyncSession) -> None:
    business = (
        await db.execute(select(Business).where(Business.slug == demo_data.BUSINESS["slug"]))
    ).scalar_one_or_none()
    if business is None:
        return
    user_ids = [row[0] for row in (await db.execute(select(User.id).where(User.business_id == business.id))).all()]
    sale_ids = [row[0] for row in (await db.execute(select(Sale.id).where(Sale.business_id == business.id))).all()]
    await db.execute(delete(StockMovement).where(StockMovement.business_id == business.id))
    if sale_ids:
        await db.execute(delete(SaleItem).where(SaleItem.sale_id.in_(sale_ids)))
    await db.execute(delete(Sale).where(Sale.business_id == business.id))
    await db.execute(delete(Announcement).where(Announcement.business_id == business.id))
    await db.execute(delete(AuditLog).where(AuditLog.business_id == business.id))
    await db.execute(delete(Product).where(Product.business_id == business.id))
    if user_ids:
        await db.execute(delete(RefreshToken).where(RefreshToken.user_id.in_(user_ids)))
    await db.execute(delete(User).where(User.business_id == business.id))
    await db.execute(delete(Business).where(Business.id == business.id))
    await db.commit()


async def ensure_user(db: AsyncSession, business: Business, name: str, email: str, password: str, role: UserRole) -> User:
    user = (await db.execute(select(User).where(User.email == email.lower()))).scalar_one_or_none()
    if user is not None:
        return user
    validate_password_strength(password)
    user = User(
        business_id=business.id, name=name, email=email.lower(), password_hash=hash_password(password), role=role
    )
    db.add(user)
    await db.flush()
    logger.info("created %s account %s", role.value, email)
    return user


def build_history(
    owner: User, staff: User, business: Business, products: dict[str, Product]
) -> tuple[list[Sale], list[StockMovement]]:
    """A week of believable sales, so the dashboard chart is not empty on first load.

    The finishing stock counts in demo_data.PRODUCTS are exact: opening stock is worked out backwards from
    them, and the stock ledger replays forward to the same numbers."""
    rng = random.Random(2027)  # Fixed seed: every fresh database gets the same demo week.
    tz = get_tz(business.timezone)
    now = datetime.now(UTC)
    local_today = now.astimezone(tz).date()

    planned: list[tuple[datetime, list[tuple[str, int]], User]] = []
    for days_ago in range(6, -1, -1):
        day = local_today - timedelta(days=days_ago)
        count = rng.randint(7, 12) if days_ago else 4
        for _ in range(count):
            hour = rng.randint(7, 18) if days_ago else rng.randint(7, 11)
            local = datetime(day.year, day.month, day.day, hour, rng.randint(0, 59), tzinfo=tz)
            moment = local.astimezone(UTC)
            if moment >= now - timedelta(minutes=5):
                moment = now - timedelta(minutes=rng.randint(10, 90))
            planned.append((moment, rng.choice(demo_data.BASKETS), rng.choice([owner, staff, staff])))
    planned.sort(key=lambda entry: entry[0])

    sold: dict[str, int] = {name: 0 for name in products}
    for _, basket, _ in planned:
        for name, quantity in basket:
            sold[name] += quantity

    running: dict[str, int] = {}
    opening_at = planned[0][0] - timedelta(hours=1)
    for name, product in products.items():
        # Opening stock, worked out backwards. Every sale below walks the count down to the final figure.
        running[name] = product.stock_qty + sold[name]
    stock_rows: list[StockMovement] = []
    for name, product in products.items():
        stock_rows.append(
            StockMovement(
                business_id=business.id,
                product_id=product.id,
                user_id=owner.id,
                delta=running[name],
                quantity_after=running[name],
                reason=StockReason.INITIAL,
                note="Opening stock",
                created_at=opening_at,
            )
        )

    sales: list[Sale] = []
    for moment, basket, cashier in planned:
        sale = Sale(
            id=uuid4(), business_id=business.id, user_id=cashier.id, total_cents=0, unit_count=0, created_at=moment
        )
        for name, quantity in basket:
            product = products[name]
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
            sale.total_cents += line_total
            sale.unit_count += quantity
            running[name] -= quantity
            stock_rows.append(
                StockMovement(
                    business_id=business.id,
                    product_id=product.id,
                    user_id=cashier.id,
                    sale_id=sale.id,
                    delta=-quantity,
                    quantity_after=running[name],
                    reason=StockReason.SALE,
                    created_at=moment,
                )
            )
        sales.append(sale)
    return sales, stock_rows


async def seed(db: AsyncSession) -> None:
    settings = get_settings()
    business = (
        await db.execute(select(Business).where(Business.slug == demo_data.BUSINESS["slug"]))
    ).scalar_one_or_none()
    created = business is None
    if created:
        business = Business(**demo_data.BUSINESS)
        db.add(business)
        await db.flush()
        logger.info("created demo business %s", business.slug)

    owner = await ensure_user(
        db, business, demo_data.OWNER_NAME, settings.seed_owner_email, settings.seed_owner_password, UserRole.OWNER
    )
    staff = await ensure_user(
        db, business, demo_data.STAFF_NAME, settings.seed_staff_email, settings.seed_staff_password, UserRole.STAFF
    )

    if created:
        products: dict[str, Product] = {}
        for name, category, price, stock, threshold in demo_data.PRODUCTS:
            product = Product(
                business_id=business.id,
                name=name,
                category=category,
                price_cents=price,
                stock_qty=stock,
                low_stock_threshold=threshold,
                is_featured=True,
            )
            db.add(product)
            products[name] = product
        await db.flush()

        if settings.seed_demo_history:
            sales, movements = build_history(owner, staff, business, products)
            db.add_all(sales)
            await db.flush()
            db.add_all(movements)
        else:
            for product in products.values():
                db.add(
                    StockMovement(
                        business_id=business.id,
                        product_id=product.id,
                        user_id=owner.id,
                        delta=product.stock_qty,
                        quantity_after=product.stock_qty,
                        reason=StockReason.INITIAL,
                        note="Opening stock",
                    )
                )
    await db.commit()


async def main(reset: bool) -> None:
    settings = get_settings()
    if not settings.seed_demo_data and not reset:
        logger.info("SEED_DEMO_DATA is false; nothing to do")
        return
    async with AsyncSessionLocal() as db:
        if reset:
            if settings.app_env == "production":
                logger.error("Refusing --reset when APP_ENV=production")
                sys.exit(1)
            await wipe_demo_business(db)
        await seed(db)
    logger.info("seed complete")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="delete the demo shop's data and rebuild it")
    args = parser.parse_args()
    asyncio.run(main(args.reset))
