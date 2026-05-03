"""
Question models.

Architecture:
  questions        → global pool of template questions (no group, no author)
  group_questions  → a question from the pool assigned to a specific group
  answers          → a member's answer to a group_question
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import uuid4

from sqlmodel import Field, SQLModel


class QuestionCategory(str, Enum):
    picante  = "picante"
    incomoda = "incomoda"
    graciosa = "graciosa"
    general  = "general"


# ── Global question pool ──────────────────────────────────────────────────────

class Question(SQLModel, table=True):
    """Template questions that live in the global pool."""

    __tablename__: str = "questions"

    id:         Optional[int]            = Field(default=None, primary_key=True)
    uuid:       str                      = Field(default_factory=lambda: str(uuid4()), index=True)
    category:   str                      = Field(default="general", index=True)
    text:       str                      = Field(max_length=500)
    image_url:  Optional[str]            = Field(default=None, max_length=500)
    is_active:  bool                     = Field(default=True)
    created_at: datetime                 = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime]       = Field(default=None)


# ── Group question (pool question assigned to a group) ────────────────────────

class GroupQuestion(SQLModel, table=True):
    """Represents a pool question that has been sent to a group."""

    __tablename__: str = "group_questions"

    id:            Optional[int]      = Field(default=None, primary_key=True)
    uuid:          str                = Field(default_factory=lambda: str(uuid4()), index=True)
    question_uuid: str                = Field(index=True)  # FK → questions.uuid
    group_uuid:    str                = Field(index=True)  # FK → groups.uuid
    status:        str                = Field(default="active")  # "active" | "closed"
    answer_count:  int                = Field(default=0)
    sent_at:       datetime           = Field(default_factory=datetime.utcnow)
    closed_at:     Optional[datetime] = Field(default=None)
    created_at:    datetime           = Field(default_factory=datetime.utcnow)


# ── Answer ────────────────────────────────────────────────────────────────────

class Answer(SQLModel, table=True):
    """A member's answer to a group_question."""

    __tablename__: str = "answers"

    id:                  Optional[int]      = Field(default=None, primary_key=True)
    uuid:                str                = Field(default_factory=lambda: str(uuid4()), index=True)
    group_question_uuid: str                = Field(index=True)  # FK → group_questions.uuid
    author_uuid:         str                = Field(index=True)  # FK → users.uuid
    selected_user_uuid:  str                = Field(index=True)  # the chosen user's uuid
    created_at:          datetime           = Field(default_factory=datetime.utcnow)
    updated_at:          Optional[datetime] = Field(default=None)
