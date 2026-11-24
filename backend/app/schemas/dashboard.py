from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models import ShopStatus
from app.schemas.product import ProductOut
from app.schemas.sale import SaleOut


class Kpis(BaseModel):
    active_products: int
    low_stock_count: int
    out_of_stock_count: int
    sales_today_count: int
    sales_today_cents: int
    units_sold_today: int


class TopSeller(BaseModel):
    product_id: UUID
    name: str
    quantity: int
    revenue_cents: int


class DailyTotal(BaseModel):
    date: str
    label: str
    total_cents: int
    sale_count: int
    is_today: bool


class DashboardBusiness(BaseModel):
    name: str
    status: ShopStatus
    status_message: str | None


class DashboardSummary(BaseModel):
    business: DashboardBusiness
    kpis: Kpis
    low_stock_items: list[ProductOut]
    top_sellers_today: list[TopSeller]
    sales_last_7_days: list[DailyTotal]
    recent_sales: list[SaleOut]
    generated_at: datetime
