from typing import Optional

from pydantic import BaseModel, Field


class AuthorInfo(BaseModel):
    id: str
    name: str
    avatar_url: Optional[str] = None


class CreateQuestionRequest(BaseModel):
    group_id: str
    text: str = Field(min_length=1, max_length=500)
    image_url: Optional[str] = None


class QuestionResponse(BaseModel):
    id: str
    group_id: str
    author: AuthorInfo
    text: str
    image_url: Optional[str]
    answer_count: int
    my_answer: Optional["AnswerResponse"] = None
    status: str
    created_at: str
    updated_at: Optional[str]


class CreateAnswerRequest(BaseModel):
    question_id: str
    # text contains the uuid of the selected user
    text: str = Field(min_length=1)
    image_url: Optional[str] = None


class AnswerResponse(BaseModel):
    id: str
    question_id: str
    author: AuthorInfo
    # text returns the uuid of the selected user — frontend resolves to name
    text: str
    image_url: Optional[str]
    created_at: str
    updated_at: Optional[str]


QuestionResponse.model_rebuild()
