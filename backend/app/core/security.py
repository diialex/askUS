"""
JWT token management.
Provides functions to create and verify JWT tokens.
"""

from datetime import datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHash

from app.core.config import settings

# Password hashing with Argon2
hasher = PasswordHasher()


def hash_password(password: str) -> str:
    """
    Hash a password using Argon2.

    Args:
        password: Plain text password.

    Returns:
        Hashed password string.
    """
    return hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.

    Args:
        plain_password: Plain text password.
        hashed_password: Hashed password from database.

    Returns:
        True if password matches, False otherwise.
    """
    try:
        hasher.verify(hashed_password, plain_password)
        return True
    except InvalidHash:
        return False


def create_access_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    """
    Create a JWT access token.

    Args:
        subject: Token subject (usually user ID).
        expires_delta: Optional expiration time delta.

    Returns:
        Encoded JWT token string.
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode: dict[str, Any] = {"exp": expire, "sub": str(subject), "type": "access"}
    encoded_jwt = jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(subject: str | Any) -> str:
    """
    Create a JWT refresh token.

    Args:
        subject: Token subject (usually user ID).

    Returns:
        Encoded JWT token string.
    """
    expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode: dict[str, Any] = {"exp": expire, "sub": str(subject), "type": "refresh"}
    encoded_jwt = jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and verify a JWT token.

    Args:
        token: JWT token string.

    Returns:
        Decoded token payload.

    Raises:
        jwt.PyJWTError: If token is invalid.
    """
    return jwt.decode(
        token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )
