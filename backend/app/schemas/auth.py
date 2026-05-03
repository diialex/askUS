"""
Authentication schemas.
Defines request/response models for auth endpoints.
"""

from pydantic import BaseModel, EmailStr, Field


# ─── Requests ───────────────────────────────────────────────────────────────


class LoginRequest(BaseModel):
    """Login request payload."""

    email: EmailStr
    password: str = Field(min_length=6)


class RegisterRequest(BaseModel):
    """Register request payload."""

    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    password_confirmation: str


class RefreshTokenRequest(BaseModel):
    """Refresh token request payload."""

    refresh_token: str


class PushTokenRequest(BaseModel):
    """Register Expo push token."""

    push_token: str
    platform: str = Field(pattern="^(ios|android)$")


# ─── Responses ─────────────────────────────────────────────────────────────


class AuthTokens(BaseModel):
    """JWT tokens response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 3600


class UserResponse(BaseModel):
    """User data for responses."""

    id: str
    name: str
    email: str
    avatar_url: str | None = None
    created_at: str
    updated_at: str | None = None

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    """Authentication response with user and tokens."""

    user: UserResponse
    tokens: AuthTokens
