"""
User model using SQLModel.
Includes fields: id (UUID), name, email, hashed_password, created_at.
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    """
    User model mapped to the 'users' table in PostgreSQL.
    Uses SQLModel with table=True for ORM mapping.
    """

    __tablename__: str = "users"

    # Primary key
    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(
        default_factory=uuid4,
        index=True,
        description="Unique identifier UUID4",
    )

# User credentials (name from frontend)
    username: str = Field(
        max_length=100,
        unique=True,
        index=True,
        description="User display name",
    )
    email: str = Field(
        max_length=255,
        unique=True,
        index=True,
        description="User email address",
    )
    hashed_password: str = Field(
        max_length=255,
        description="Bcrypt hashed password",
    )

    # Timestamps
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="User creation timestamp",
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        description="User last update timestamp",
    )

    # Boolean flags
    is_active: bool = Field(default=True, description="Is user active")
    is_verified: bool = Field(default=False, description="Is email verified")
    is_superuser: bool = Field(default=False, description="Is superuser")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, name={self.name}, email={self.email})>"
