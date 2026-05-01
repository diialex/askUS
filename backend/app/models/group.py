from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlmodel import Field, SQLModel


class Group(SQLModel, table=True):
    __tablename__: str = "groups"

    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(default_factory=lambda: str(uuid4()), index=True)
    name: str = Field(max_length=100, index=True)
    description: Optional[str] = Field(default=None, max_length=500)
    cover_url: Optional[str] = Field(default=None, max_length=500)
    created_by: str = Field(index=True)  # references users.uuid
    member_count: int = Field(default=1)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)


class GroupMember(SQLModel, table=True):
    __tablename__: str = "group_members"

    id: Optional[int] = Field(default=None, primary_key=True)
    group_uuid: str = Field(index=True)
    user_uuid: str = Field(index=True)
    role: str = Field(default="member")  # "admin" | "member"
    joined_at: datetime = Field(default_factory=datetime.utcnow)
