from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.models import Announcement, Business, Product
from app.schemas.business import DayHours, OpeningHours
from app.schemas.public import PublicAnnouncement, PublicProduct, PublicShop
from app.services.stock import stock_state
from app.services.timeutil import DAY_KEYS, get_tz, local_now

MAX_PUBLIC_PRODUCTS = 24


async def build_public_shop(db: AsyncSession, slug: str) -> PublicShop:
    """The only data a logged-out customer can see. It is assembled field by field, so private information
    (exact stock counts, product ids, sales, staff) cannot leak by accident."""
    business = (await db.execute(select(Business).where(Business.slug == slug.lower()))).scalar_one_or_none()
    if business is None:
        raise NotFound("We could not find that shop.", code="shop_not_found")

    now = datetime.now(UTC)

    base = select(Product).where(Product.business_id == business.id, Product.is_active.is_(True))
    products = (
        (await db.execute(base.where(Product.is_featured.is_(True)).order_by(Product.category, Product.name)))
        .scalars()
        .all()
    )
    if not products:  # An owner who has not picked featured products yet still gets a useful page.
        products = (await db.execute(base.order_by(Product.category, Product.name))).scalars().all()
    products = list(products)[:MAX_PUBLIC_PRODUCTS]

    announcement = (
        await db.execute(
            select(Announcement)
            .where(
                Announcement.business_id == business.id,
                Announcement.is_active.is_(True),
                Announcement.active_from <= now,
                or_(Announcement.expires_at.is_(None), Announcement.expires_at > now),
            )
            .order_by(Announcement.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    latest_product_change = (
        await db.execute(
            select(func.max(Product.updated_at)).where(Product.business_id == business.id, Product.is_active.is_(True))
        )
    ).scalar_one_or_none()

    candidates = [business.updated_at, business.status_updated_at]
    if latest_product_change:
        candidates.append(latest_product_change)
    if announcement:
        candidates.append(announcement.created_at)

    hours = OpeningHours.model_validate(business.hours)
    today_key = DAY_KEYS[local_now(get_tz(business.timezone)).weekday()]
    today: DayHours = getattr(hours, today_key)

    return PublicShop(
        slug=business.slug,
        name=business.name,
        area_label=business.area_label,
        status=business.status,
        status_message=business.status_message,
        hours=hours,
        today_key=today_key,
        today=today,
        contact_note=business.contact_note,
        announcement=(
            PublicAnnouncement(
                title=announcement.title,
                body=announcement.body,
                tone=announcement.tone,
                expires_at=announcement.expires_at,
            )
            if announcement
            else None
        ),
        products=[
            PublicProduct(
                name=p.name,
                category=p.category,
                price_cents=p.price_cents,
                availability=stock_state(p.stock_qty, p.low_stock_threshold),
            )
            for p in products
        ],
        categories=sorted({p.category for p in products}),
        updated_at=max(candidates),
        generated_at=now,
    )
