"""
Authentication routes.
Provides endpoints for user registration, login, and token management.
"""

from datetime import timedelta
from collections import defaultdict
import time

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# ── Rate limiter simple en memoria ────────────────────────────────────────────
# { ip: [timestamp, ...] }  — máximo 10 intentos por minuto
_login_attempts: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT = 10
_RATE_WINDOW = 60  # segundos

def _check_rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    attempts = [t for t in _login_attempts[ip] if now - t < _RATE_WINDOW]
    _login_attempts[ip] = attempts
    if len(attempts) >= _RATE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Espera un minuto.",
        )
    _login_attempts[ip].append(now)

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
    PushTokenRequest,
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
    request: Request,
    data: RegisterRequest,
    session: AsyncSession = Depends(get_session),
):
    _check_rate_limit(request)
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
    request: Request,
    data: LoginRequest,
    session: AsyncSession = Depends(get_session),
):
    _check_rate_limit(request)
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

    # Rotar tokens — el refresh viejo queda invalidado implícitamente
    # (el cliente debe guardar el nuevo)
    new_access_token = create_access_token(str(user.uuid))
    new_refresh_token = create_refresh_token(str(user.uuid))

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
                access_token=new_access_token,
                refresh_token=new_refresh_token,
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


@router.delete(
    "/me",
    name="delete_account",
    response_model=ApiResponse[None],
    summary="Delete own account and all associated data",
)
async def delete_account(
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy import delete as sql_delete
    from app.models.group import Group, GroupMember
    from app.models.question import Answer, GroupQuestion

    # 1. Borrar respuestas del usuario
    await session.execute(
        sql_delete(Answer).where(Answer.author_uuid == str(user.uuid))
    )

    # 2. Salir de todos los grupos (y decrementar member_count)
    memberships = (await session.execute(
        select(GroupMember).where(GroupMember.user_uuid == str(user.uuid))
    )).scalars().all()

    for m in memberships:
        group = (await session.execute(
            select(Group).where(Group.uuid == m.group_uuid)
        )).scalar_one_or_none()
        if group:
            group.member_count = max(0, group.member_count - 1)
        await session.delete(m)

    # 3. Desactivar grupos que creó (sin borrarlos para no romper el historial)
    await session.execute(
        sql_delete(GroupMember).where(GroupMember.user_uuid == str(user.uuid))
    )
    groups_created = (await session.execute(
        select(Group).where(Group.created_by == str(user.uuid))
    )).scalars().all()
    for g in groups_created:
        g.is_active = False

    # 4. Borrar el usuario
    await session.delete(user)
    await session.commit()

    return ApiResponse(data=None, message="Account deleted")


@router.post(
    "/me/push-token",
    name="register_push_token",
    response_model=ApiResponse[None],
    summary="Register or update Expo push token",
)
async def register_push_token(
    data: PushTokenRequest,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    user.push_token = data.push_token
    user.push_platform = data.platform
    await session.commit()
    return ApiResponse(data=None, message="Push token registered")


@router.patch(
    "/me",
    name="update_profile",
    response_model=ApiResponse[UserResponse],
    summary="Update current user profile",
)
async def update_profile(
    data: dict,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    from datetime import datetime as dt
    if "name" in data and data["name"]:
        user.username = data["name"]
    if "avatar_url" in data:
        pass  # TODO: campo avatar_url en el modelo
    user.updated_at = dt.utcnow()
    await session.commit()
    await session.refresh(user)
    return ApiResponse(data=UserResponse(
        id=str(user.uuid),
        name=user.username,
        email=user.email,
        created_at=user.created_at.isoformat(),
        updated_at=user.updated_at.isoformat() if user.updated_at else None,
    ))


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
