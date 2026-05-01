from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlmodel import Field, SQLModel


class Question(SQLModel, table=True):
    __tablename__: str = "questions"

    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(default_factory=lambda: str(uuid4()), index=True)
    group_uuid: str = Field(index=True)       # references groups.uuid
    author_uuid: str = Field(index=True)      # references users.uuid
    text: str = Field(max_length=500)
    image_url: Optional[str] = Field(default=None, max_length=500)
    answer_count: int = Field(default=0)
    status: str = Field(default="open")       # "open" | "closed"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)


class Answer(SQLModel, table=True):
    __tablename__: str = "answers"

    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(default_factory=lambda: str(uuid4()), index=True)
    question_uuid: str = Field(index=True)    # references questions.uuid
    author_uuid: str = Field(index=True)      # who voted (references users.uuid)
    # stores the uuid of the selected user (the actual answer)
    selected_user_uuid: str = Field(index=True)
    image_url: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)
