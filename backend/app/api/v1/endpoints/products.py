from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import Permission
from app.database.session import get_db_session
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate, StockAdjustmentCreate
from app.security.dependencies import AuthContext, require_permission
from app.services import product_service

router = APIRouter()


@router.get("", response_model=list[ProductOut])
async def list_products(
    include_archived: bool = False,
    q: str | None = Query(default=None, max_length=80),
    category: str | None = Query(default=None, max_length=40),
    ctx: AuthContext = Depends(require_permission(Permission.PRODUCTS_VIEW)),
    db: AsyncSession = Depends(get_db_session),
) -> list[ProductOut]:
    # Only owners may look at archived products; for staff the flag is ignored.
    show_archived = include_archived and ctx.can(Permission.PRODUCTS_MANAGE)
    products = await product_service.list_products(
        db, ctx.business_id, include_archived=show_archived, query=q, category=category
    )
    return [ProductOut.model_validate(product) for product in products]


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    ctx: AuthContext = Depends(require_permission(Permission.PRODUCTS_MANAGE)),
    db: AsyncSession = Depends(get_db_session),
) -> ProductOut:
    return ProductOut.model_validate(await product_service.create_product(db, ctx, payload))


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: UUID,
    payload: ProductUpdate,
    ctx: AuthContext = Depends(require_permission(Permission.PRODUCTS_MANAGE)),
    db: AsyncSession = Depends(get_db_session),
) -> ProductOut:
    return ProductOut.model_validate(await product_service.update_product(db, ctx, product_id, payload))


@router.post("/{product_id}/archive", response_model=ProductOut)
async def archive_product(
    product_id: UUID,
    ctx: AuthContext = Depends(require_permission(Permission.PRODUCTS_MANAGE)),
    db: AsyncSession = Depends(get_db_session),
) -> ProductOut:
    return ProductOut.model_validate(await product_service.set_product_active(db, ctx, product_id, False))


@router.post("/{product_id}/restore", response_model=ProductOut)
async def restore_product(
    product_id: UUID,
    ctx: AuthContext = Depends(require_permission(Permission.PRODUCTS_MANAGE)),
    db: AsyncSession = Depends(get_db_session),
) -> ProductOut:
    return ProductOut.model_validate(await product_service.set_product_active(db, ctx, product_id, True))


@router.post("/{product_id}/stock-adjustments", response_model=ProductOut)
async def adjust_stock(
    product_id: UUID,
    payload: StockAdjustmentCreate,
    ctx: AuthContext = Depends(require_permission(Permission.PRODUCTS_MANAGE)),
    db: AsyncSession = Depends(get_db_session),
) -> ProductOut:
    return ProductOut.model_validate(await product_service.adjust_stock(db, ctx, product_id, payload))
