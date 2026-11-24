from collections.abc import Callable
from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import Forbidden, Unauthorized
from app.core.permissions import ROLE_PERMISSIONS, Permission
from app.database.session import get_db_session
from app.models import Business, User
from app.security.jwt import TokenError, decode_token

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    """Who is calling, which shop they belong to and what they may do. Built from the database on every
    request, never from claims inside the token, so a disabled account or a changed role takes effect at once."""

    user: User
    business: Business
    permissions: frozenset[Permission]

    @property
    def business_id(self) -> UUID:
        return self.business.id

    def can(self, permission: Permission) -> bool:
        return permission in self.permissions


def _unauthorized(message: str = "Sign in to continue.") -> Unauthorized:
    return Unauthorized(message, headers={"WWW-Authenticate": "Bearer"})


async def get_auth_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db_session),
) -> AuthContext:
    if credentials is None:
        raise _unauthorized()

    try:
        payload = decode_token(credentials.credentials)
    except TokenError:
        raise _unauthorized("Your session has expired. Sign in again.") from None

    if payload.get("type") != "access":
        raise _unauthorized("Your session has expired. Sign in again.")

    try:
        user_id = UUID(str(payload.get("sub")))
    except ValueError:
        raise _unauthorized("Your session has expired. Sign in again.") from None

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise _unauthorized("This account is not active.")

    business = await db.get(Business, user.business_id)
    if business is None:
        raise _unauthorized("This account is not active.")

    return AuthContext(user=user, business=business, permissions=ROLE_PERMISSIONS.get(user.role.value, frozenset()))


async def make_context(db: AsyncSession, user: User) -> AuthContext:
    """Build the context for a user who has just proved who they are (sign-in, token refresh)."""
    business = await db.get(Business, user.business_id)
    if business is None:
        raise _unauthorized("This account is not active.")
    return AuthContext(user=user, business=business, permissions=ROLE_PERMISSIONS.get(user.role.value, frozenset()))


def require_permission(*required: Permission) -> Callable:
    """Dependency factory: 401 when not signed in, 403 when signed in without the permission."""

    async def checker(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if not all(permission in ctx.permissions for permission in required):
            raise Forbidden("You do not have permission to do that.")
        return ctx

    return checker


def token_lifetimes() -> tuple[int, int]:
    settings = get_settings()
    return settings.access_token_expire_minutes * 60, settings.refresh_token_expire_days * 86400
