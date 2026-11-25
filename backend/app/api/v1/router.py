from fastapi import APIRouter

from app.api.v1.endpoints import (
    activity,
    announcements,
    auth,
    business,
    dashboard,
    health,
    orders,
    products,
    public,
    sales,
)

router = APIRouter()
router.include_router(health.router, tags=["health"])
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(products.router, prefix="/products", tags=["products"])
router.include_router(sales.router, prefix="/sales", tags=["sales"])
router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
router.include_router(business.router, prefix="/business", tags=["business"])
router.include_router(announcements.router, prefix="/announcements", tags=["announcements"])
router.include_router(activity.router, prefix="/activity", tags=["activity"])
router.include_router(public.router, prefix="/public", tags=["public"])
router.include_router(orders.router, prefix="/orders", tags=["orders"])
