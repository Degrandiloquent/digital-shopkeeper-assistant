"""Roles and what they may do. The backend enforces this on every request; hiding a button in the
interface is never the only protection."""

from enum import Enum


class Permission(str, Enum):
    DASHBOARD_VIEW = "dashboard.view"
    PRODUCTS_VIEW = "products.view"
    PRODUCTS_MANAGE = "products.manage"
    SALES_CREATE = "sales.create"
    SALES_VIEW_ALL = "sales.view_all"
    SALES_VIEW_OWN = "sales.view_own"
    BUSINESS_VIEW = "business.view"
    BUSINESS_MANAGE = "business.manage"
    ANNOUNCEMENTS_MANAGE = "announcements.manage"
    ACTIVITY_VIEW = "activity.view"


OWNER_PERMISSIONS = frozenset(Permission)

STAFF_PERMISSIONS = frozenset(
    {
        Permission.PRODUCTS_VIEW,
        Permission.SALES_CREATE,
        Permission.SALES_VIEW_OWN,
        Permission.BUSINESS_VIEW,
    }
)

ROLE_PERMISSIONS: dict[str, frozenset[Permission]] = {
    "owner": OWNER_PERMISSIONS,
    "staff": STAFF_PERMISSIONS,
}
