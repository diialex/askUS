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
    invite_code: Optional[str] = None   # solo visible para miembros
    created_at: str
    updated_at: Optional[str]


class InviteResponse(BaseModel):
    invite_code: str
    invite_url: str      # deep link: askus://join/{code}
