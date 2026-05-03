"""
Schemas for the questions module.

Architecture:
  Question        → global pool (has category, is_active)
  GroupQuestion   → pool question assigned to a specific group
  Answer          → a member's answer to a GroupQuestion
"""

from typing import Optional
from enum import Enum

from pydantic import BaseModel, Field


# ── Enums ─────────────────────────────────────────────────────────────────────

class QuestionCategory(str, Enum):
    picante  = "picante"
    incomoda = "incomoda"
    graciosa = "graciosa"
    general  = "general"


# ── Shared sub-schemas ────────────────────────────────────────────────────────

class UserInfo(BaseModel):
    id: str
    name: str
    avatar_url: Optional[str] = None


# ── Pool Question ─────────────────────────────────────────────────────────────

class CreateQuestionRequest(BaseModel):
    text:      str                   = Field(min_length=1, max_length=500)
    category:  QuestionCategory      = QuestionCategory.general
    image_url: Optional[str]         = None


class UpdateQuestionRequest(BaseModel):
    text:      Optional[str]         = Field(default=None, min_length=1, max_length=500)
    category:  Optional[QuestionCategory] = None
    is_active: Optional[bool]        = None


class QuestionResponse(BaseModel):
    id:         str
    category:   str
    text:       str
    image_url:  Optional[str]
    is_active:  bool
    created_at: str


# ── Group Question ────────────────────────────────────────────────────────────

class SendQuestionToGroupRequest(BaseModel):
    """Send a question from the pool to a group.
    If question_uuid is omitted a random active question is chosen.
    """
    question_uuid: Optional[str]     = None
    category:      Optional[QuestionCategory] = None   # filter for random pick


class GroupQuestionResponse(BaseModel):
    id:           str
    group_uuid:   str
    question:     QuestionResponse
    status:       str   # "active" | "closed"
    answer_count: int
    my_answer:    Optional["AnswerResponse"] = None
    sent_at:      str
    closed_at:    Optional[str]
    created_at:   str


# ── Answer ────────────────────────────────────────────────────────────────────

class CreateAnswerRequest(BaseModel):
    group_question_uuid: str
    selected_user_uuid:  str   # uuid of the chosen group member


class AnswerResponse(BaseModel):
    id:                  str
    group_question_uuid: str
    author:              UserInfo
    selected_user_uuid:  str
    created_at:          str
    updated_at:          Optional[str]


GroupQuestionResponse.model_rebuild()
