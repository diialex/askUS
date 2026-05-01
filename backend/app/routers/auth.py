"""
Authentication routes.
Provides endpoints for user registration, login, and token management.
"""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import CurrentUser
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.database import get_session
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    AuthTokens,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    UserResponse,
)
from app.schemas.base import ApiResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    name="register",
    response_model=ApiResponse[AuthResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register new user",
    description="Create a new user account",
)
async def register(
    data: RegisterRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Register a new user.
    Validates password confirmation and checks for existing email/username.
    """
    # Validate password match
    if data.password != data.password_confirmation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match",
        )

    # Check if email already exists
    result = await session.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Check if username already exists
    result = await session.execute(
        select(User).where(User.username == data.name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    # Create new user
    hashed_pw = hash_password(data.password)
    new_user = User(
        username=data.name,
        email=data.email,
        hashed_password=hashed_pw,
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)

    # Generate tokens
    access_token = create_access_token(str(new_user.uuid))
    refresh_token = create_refresh_token(str(new_user.uuid))

    return ApiResponse(
        data=AuthResponse(
            user=UserResponse(
                id=str(new_user.uuid),
                name=new_user.username,
                email=new_user.email,
                created_at=new_user.created_at.isoformat(),
                updated_at=new_user.updated_at.isoformat() if new_user.updated_at else None,
            ),
            tokens=AuthTokens(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            ),
        ),
        message="User registered successfully",
    )


@router.post(
    "/login",
    name="login",
    response_model=ApiResponse[AuthResponse],
    summary="User login",
    description="Authenticate user and return tokens",
)
async def login(
    data: LoginRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Authenticate user credentials and return JWT tokens.
    """
    # Find user by email
    result = await session.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    # Generate tokens
    access_token = create_access_token(str(user.uuid))
    refresh_token = create_refresh_token(str(user.uuid))

    return ApiResponse(
        data=AuthResponse(
            user=UserResponse(
                id=str(user.uuid),
                name=user.username,
                email=user.email,
                created_at=user.created_at.isoformat(),
                updated_at=user.updated_at.isoformat() if user.updated_at else None,
            ),
            tokens=AuthTokens(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            ),
        ),
        message="Login successful",
    )


@router.post(
    "/refresh",
    name="refresh_token",
    response_model=ApiResponse[AuthResponse],
    summary="Refresh access token",
    description="Exchange refresh token for new access token",
)
async def refresh_token(
    data: RefreshTokenRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Refresh access token using refresh token.
    """
    try:
        payload = decode_token(data.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        user_uuid = payload.get("sub")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Find user
    result = await session.execute(select(User).where(User.uuid == user_uuid))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or disabled",
        )

    # Generate new tokens
    access_token = create_access_token(str(user.uuid))
    refresh_token = create_refresh_token(str(user.uuid))

    return ApiResponse(
        data=AuthResponse(
            user=UserResponse(
                id=str(user.uuid),
                name=user.username,
                email=user.email,
                created_at=user.created_at.isoformat(),
                updated_at=user.updated_at.isoformat() if user.updated_at else None,
            ),
            tokens=AuthTokens(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            ),
        ),
        message="Token refreshed successfully",
    )


@router.post(
    "/logout",
    name="logout",
    response_model=ApiResponse[None],
    summary="User logout",
    description="Invalidate user tokens",
)
async def logout():
    """
    Logout user.
    Note: In a production system, you would blacklist the token.
    For now, we just return success - client removes tokens.
    """
    return ApiResponse(
        data=None,
        message="Logout successful",
    )


@router.get(
    "/me",
    name="current_user",
    response_model=ApiResponse[UserResponse],
    summary="Get current user",
    description="Get authenticated user profile",
)
async def read_current_user(
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """
    Get current authenticated user.
    Requires valid JWT access token.
    """
    return ApiResponse(
        data=UserResponse(
            id=str(user.uuid),
            name=user.username,
            email=user.email,
            created_at=user.created_at.isoformat(),
            updated_at=user.updated_at.isoformat() if user.updated_at else None,
        ),
        message="Current user retrieved",
    )
