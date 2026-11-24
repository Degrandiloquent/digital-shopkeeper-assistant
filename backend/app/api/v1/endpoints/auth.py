from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import Permission
from app.database.session import get_db_session
from app.models import utcnow
from app.schemas.auth import (
    BusinessSummary,
    CurrentUserResponse,
    LoginRequest,
    LoginResponse,
    LogoutRequest,
    RefreshRequest,
    TokenResponse,
    UserOut,
)
from app.security.dependencies import AuthContext, get_auth_context, make_context
from app.security.rate_limit import login_throttle
from app.services.audit import record_audit
from app.services.auth_service import (
    authenticate_user,
    issue_tokens,
    revoke_refresh_token,
    rotate_refresh_token,
)

router = APIRouter()


def _me(ctx: AuthContext) -> dict:
    return {
        "user": UserOut.model_validate(ctx.user),
        "business": BusinessSummary.model_validate(ctx.business),
        "permissions": sorted(permission.value for permission in ctx.permissions if isinstance(permission, Permission)),
    }


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db_session)) -> LoginResponse:
    ip = request.client.host if request.client else "unknown"
    key = f"{payload.email.lower()}|{ip}"
    login_throttle.check(key)

    try:
        user = await authenticate_user(db, payload.email, payload.password)
    except Exception:
        login_throttle.record_failure(key)
        raise
    login_throttle.clear(key)

    user.last_login_at = utcnow()
    access_token, refresh_token, expires_in = await issue_tokens(db, user)
    ctx = await make_context(db, user)
    record_audit(db, ctx, "auth.login", "user", user.id, f"{user.name} signed in.", source_ip=ip)
    await db.commit()
    return LoginResponse(
        **_me(ctx), access_token=access_token, refresh_token=refresh_token, access_token_expires_in=expires_in
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db_session)) -> TokenResponse:
    _user, access_token, refresh_token, expires_in = await rotate_refresh_token(db, payload.refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token, access_token_expires_in=expires_in)


@router.post("/logout")
async def logout(payload: LogoutRequest, db: AsyncSession = Depends(get_db_session)) -> dict:
    await revoke_refresh_token(db, payload.refresh_token)
    return {"status": "logged_out"}


@router.get("/me", response_model=CurrentUserResponse)
async def me(ctx: AuthContext = Depends(get_auth_context)) -> CurrentUserResponse:
    return CurrentUserResponse(**_me(ctx))
