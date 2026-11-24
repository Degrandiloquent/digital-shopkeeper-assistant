from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, Field

from app.models import ShopStatus, UserRole
from app.schemas.common import ORMModel, StrictModel


class LoginRequest(StrictModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(StrictModel):
    refresh_token: str = Field(min_length=10, max_length=200)


class LogoutRequest(StrictModel):
    refresh_token: str | None = Field(default=None, max_length=200)


class BusinessSummary(ORMModel):
    id: UUID
    slug: str
    name: str
    area_label: str
    status: ShopStatus


class UserOut(ORMModel):
    id: UUID
    name: str
    email: str
    role: UserRole
    last_login_at: datetime | None = None


class CurrentUserResponse(StrictModel):
    user: UserOut
    business: BusinessSummary
    permissions: list[str]


class LoginResponse(CurrentUserResponse):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    access_token_expires_in: int


class TokenResponse(StrictModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    access_token_expires_in: int
