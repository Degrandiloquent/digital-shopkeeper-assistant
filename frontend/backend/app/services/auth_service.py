import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import Unauthorized
from app.models import RefreshToken, User, utcnow
from app.security.jwt import create_token
from app.security.password import hash_password, verify_password

INVALID_CREDENTIALS = "Invalid email or password."

_dummy_hash: str | None = None


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _timing_hash() -> str:
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = hash_password("not-a-real-password-Aa1")
    return _dummy_hash


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    """Check a sign-in. An unknown email takes as long as a wrong password and gets the same message, so
    nobody can use the form to discover which email addresses have accounts."""
    user = (await db.execute(select(User).where(User.email == email.strip().lower()))).scalar_one_or_none()
    if user is None:
        verify_password(password, _timing_hash())
        raise Unauthorized(INVALID_CREDENTIALS, code="invalid_credentials")
    if not verify_password(password, user.password_hash) or not user.is_active:
        raise Unauthorized(INVALID_CREDENTIALS, code="invalid_credentials")
    return user


async def issue_tokens(db: AsyncSession, user: User) -> tuple[str, str, int]:
    settings = get_settings()
    access_ttl = timedelta(minutes=settings.access_token_expire_minutes)
    refresh_ttl = timedelta(days=settings.refresh_token_expire_days)

    access_token = create_token(str(user.id), "access", access_ttl)
    refresh_token = secrets.token_urlsafe(48)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=_hash_token(refresh_token),
            expires_at=datetime.now(UTC) + refresh_ttl,
        )
    )
    return access_token, refresh_token, int(access_ttl.total_seconds())


async def rotate_refresh_token(db: AsyncSession, refresh_token: str) -> tuple[User, str, str, int]:
    """Swap a refresh token for a new pair. Using a token that was already swapped means it was copied, so
    every session for that account is signed out."""
    stored = (
        await db.execute(select(RefreshToken).where(RefreshToken.token_hash == _hash_token(refresh_token)))
    ).scalar_one_or_none()
    if stored is None:
        raise Unauthorized("Your session has expired. Sign in again.", code="invalid_refresh_token")

    if stored.revoked_at is not None:
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == stored.user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=utcnow())
        )
        await db.commit()
        raise Unauthorized("Your session has expired. Sign in again.", code="invalid_refresh_token")

    if stored.expires_at <= utcnow():
        raise Unauthorized("Your session has expired. Sign in again.", code="invalid_refresh_token")

    user = await db.get(User, stored.user_id)
    if user is None or not user.is_active:
        raise Unauthorized("This account is not active.", code="invalid_refresh_token")

    stored.revoked_at = utcnow()
    access_token, new_refresh_token, expires_in = await issue_tokens(db, user)
    await db.commit()
    return user, access_token, new_refresh_token, expires_in


async def revoke_refresh_token(db: AsyncSession, refresh_token: str | None) -> None:
    if not refresh_token:
        return
    stored = (
        await db.execute(select(RefreshToken).where(RefreshToken.token_hash == _hash_token(refresh_token)))
    ).scalar_one_or_none()
    if stored is not None and stored.revoked_at is None:
        stored.revoked_at = utcnow()
        await db.commit()
