from collections import defaultdict
from datetime import UTC, datetime, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models import Product, Sale, SaleItem
from app.schemas.dashboard import (
    DailyTotal,
    DashboardBusiness,
    DashboardSummary,
    Kpis,
    TopSeller,
)
from app.schemas.product import ProductOut
from app.security.dependencies import AuthContext
from app.services.sale_service import sale_to_out
from app.services.timeutil import DAY_LABELS, get_tz, local_now, start_of_local_day_utc


async def build_summary(db: AsyncSession, ctx: AuthContext) -> DashboardSummary:
    business = ctx.business
    business_id = business.id
    tz = get_tz(business.timezone)
    today_start = start_of_local_day_utc(tz)
    week_start = start_of_local_day_utc(tz, days_ago=6)

    active = Product.is_active.is_(True)
    is_low = (Product.stock_qty > 0) & (Product.stock_qty <= Product.low_stock_threshold)
    is_out = Product.stock_qty <= 0
    active_products, low_count, out_count = (
        await db.execute(
            select(
                func.count(Product.id),
                func.coalesce(func.sum(case((is_low, 1), else_=0)), 0),
                func.coalesce(func.sum(case((is_out, 1), else_=0)), 0),
            ).where(Product.business_id == business_id, active)
        )
    ).one()

    sales_count, sales_cents, units = (
        await db.execute(
            select(
                func.count(Sale.id),
                func.coalesce(func.sum(Sale.total_cents), 0),
                func.coalesce(func.sum(Sale.unit_count), 0),
            ).where(Sale.business_id == business_id, Sale.created_at >= today_start)
        )
    ).one()

    low_stock_products = (
        (
            await db.execute(
                select(Product)
                .where(Product.business_id == business_id, active, Product.stock_qty <= Product.low_stock_threshold)
                .order_by(Product.stock_qty, Product.name)
                .limit(8)
            )
        )
        .scalars()
        .all()
    )

    top_rows = (
        await db.execute(
            select(
                SaleItem.product_id,
                func.max(SaleItem.product_name),
                func.sum(SaleItem.quantity).label("qty"),
                func.sum(SaleItem.line_total_cents),
            )
            .join(Sale, Sale.id == SaleItem.sale_id)
            .where(Sale.business_id == business_id, Sale.created_at >= today_start)
            .group_by(SaleItem.product_id)
            .order_by(func.sum(SaleItem.quantity).desc())
            .limit(5)
        )
    ).all()

    week_rows = (
        await db.execute(
            select(Sale.created_at, Sale.total_cents).where(
                Sale.business_id == business_id, Sale.created_at >= week_start
            )
        )
    ).all()
    totals: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for created_at, total_cents in week_rows:
        key = created_at.astimezone(tz).date().isoformat()
        totals[key][0] += total_cents
        totals[key][1] += 1

    today_date = local_now(tz).date()
    daily = []
    for offset in range(6, -1, -1):
        day = today_date - timedelta(days=offset)
        total, count = totals.get(day.isoformat(), [0, 0])
        daily.append(
            DailyTotal(
                date=day.isoformat(),
                label=DAY_LABELS[day.weekday()],
                total_cents=total,
                sale_count=count,
                is_today=offset == 0,
            )
        )

    recent = (
        (
            await db.execute(
                select(Sale)
                .where(Sale.business_id == business_id)
                .options(selectinload(Sale.items), joinedload(Sale.user))
                .order_by(Sale.created_at.desc())
                .limit(6)
            )
        )
        .scalars()
        .all()
    )

    return DashboardSummary(
        business=DashboardBusiness(
            name=business.name, status=business.status, status_message=business.status_message
        ),
        kpis=Kpis(
            active_products=int(active_products),
            low_stock_count=int(low_count),
            out_of_stock_count=int(out_count),
            sales_today_count=int(sales_count),
            sales_today_cents=int(sales_cents),
            units_sold_today=int(units),
        ),
        low_stock_items=[ProductOut.model_validate(product) for product in low_stock_products],
        top_sellers_today=[
            TopSeller(product_id=pid, name=name, quantity=int(qty), revenue_cents=int(revenue))
            for pid, name, qty, revenue in top_rows
        ],
        sales_last_7_days=daily,
        recent_sales=[sale_to_out(sale, sale.user.name) for sale in recent],
        generated_at=datetime.now(UTC),
    )
