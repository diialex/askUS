from typing import Optional

from pydantic import BaseModel, Field


class CreateGroupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    cover_url: Optional[str] = Field(default=None, max_length=500)


class GroupResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    cover_url: Optional[str]
    member_count: int
    is_member: bool
    created_by: str
    created_at: str
    updated_at: Optional[str]
