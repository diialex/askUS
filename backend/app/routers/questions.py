"""
Questions router.

Endpoints
─────────
Pool management (global question pool):
  GET    /admin/questions              → list pool questions
  POST   /admin/questions              → add to pool
  PATCH  /admin/questions/{uuid}       → update pool question
  DELETE /admin/questions/{uuid}       → remove from pool

Group questions (questions sent to a group):
  POST   /groups/{group_id}/questions/next    → send random (or specific) question to group
  GET    /groups/{group_id}/questions         → list group's questions (paginated)
  GET    /groups/{group_id}/questions/active  → get current active question
  GET    /group-questions/{gq_id}             → detail + my_answer
  POST   /group-questions/{gq_id}/close       → close question (admin/owner only)

Answers:
  POST   /answers                             → answer a group question
  GET    /group-questions/{gq_id}/answers     → list answers for a group question
  DELETE /answers/{answer_id}                 → delete own answer
"""

import math
import random
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser
from app.db.database import get_session
from app.models.group import Group, GroupMember
from app.models.question import Answer, GroupQuestion, Question
from app.models.user import User
from app.schemas.base import ApiResponse
from app.schemas.question import (
    AnswerResponse,
    CreateAnswerRequest,
    CreateQuestionRequest,
    GroupQuestionResponse,
    QuestionResponse,
    SendQuestionToGroupRequest,
    UpdateQuestionRequest,
    UserInfo,
)

router = APIRouter(tags=["Questions"])


# ── helpers ───────────────────────────────────────────────────────────────────

async def _get_user(session: AsyncSession, user_uuid: str) -> User | None:
    result = await session.execute(select(User).where(User.uuid == user_uuid))
    return result.scalar_one_or_none()


def _user_info(user: User | None) -> UserInfo:
    if user is None:
        return UserInfo(id="", name="Unknown")
    return UserInfo(id=str(user.uuid), name=user.username, avatar_url=None)


def _serialize_question(q: Question) -> QuestionResponse:
    return QuestionResponse(
        id=str(q.uuid),
        category=q.category,
        text=q.text,
        image_url=q.image_url,
        is_active=q.is_active,
        created_at=q.created_at.isoformat(),
    )


def _serialize_answer(ans: Answer, author: User | None) -> AnswerResponse:
    return AnswerResponse(
        id=str(ans.uuid),
        group_question_uuid=str(ans.group_question_uuid),
        author=_user_info(author),
        selected_user_uuid=str(ans.selected_user_uuid),
        created_at=ans.created_at.isoformat(),
        updated_at=ans.updated_at.isoformat() if ans.updated_at else None,
    )


async def _serialize_group_question(
    session: AsyncSession,
    gq: GroupQuestion,
    current_user_uuid: str,
) -> GroupQuestionResponse:
    # fetch pool question
    q_result = await session.execute(
        select(Question).where(Question.uuid == gq.question_uuid)
    )
    question = q_result.scalar_one_or_none()
    q_resp = _serialize_question(question) if question else QuestionResponse(
        id="", category="general", text="(deleted)", image_url=None,
        is_active=False, created_at="",
    )

    # fetch current user's answer (if any)
    my_ans_result = await session.execute(
        select(Answer).where(
            Answer.group_question_uuid == gq.uuid,
            Answer.author_uuid == current_user_uuid,
        )
    )
    my_ans = my_ans_result.scalar_one_or_none()
    my_answer_resp = None
    if my_ans:
        author = await _get_user(session, str(my_ans.author_uuid))
        my_answer_resp = _serialize_answer(my_ans, author)

    return GroupQuestionResponse(
        id=str(gq.uuid),
        group_uuid=str(gq.group_uuid),
        question=q_resp,
        status=gq.status,
        answer_count=gq.answer_count,
        my_answer=my_answer_resp,
        sent_at=gq.sent_at.isoformat(),
        closed_at=gq.closed_at.isoformat() if gq.closed_at else None,
        created_at=gq.created_at.isoformat(),
    )


async def _require_member(
    session: AsyncSession, group_uuid: str, user_uuid: str
) -> None:
    result = await session.execute(
        select(GroupMember).where(
            GroupMember.group_uuid == group_uuid,
            GroupMember.user_uuid == user_uuid,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a group member"
        )


async def _require_group_admin(
    session: AsyncSession, group_uuid: str, user_uuid: str
) -> None:
    result = await session.execute(
        select(Group).where(Group.uuid == group_uuid, Group.is_active == True)
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if str(group.created_by) != user_uuid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only the group owner can do this"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Pool management
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/admin/questions",
    response_model=dict,
    summary="List all questions in the pool",
)
async def list_pool_questions(
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    category: str | None = None,
    active_only: bool = False,
    page: int = 1,
):
    filters = []
    if category:
        filters.append(Question.category == category)
    if active_only:
        filters.append(Question.is_active == True)

    per_page = 50
    offset = (page - 1) * per_page

    total = (
        await session.execute(select(func.count(Question.id)).where(*filters))
    ).scalar_one()

    q_result = await session.execute(
        select(Question)
        .where(*filters)
        .order_by(Question.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    questions = q_result.scalars().all()

    return {
        "success": True,
        "data": [_serialize_question(q) for q in questions],
        "meta": {
            "current_page": page,
            "last_page": max(1, math.ceil(total / per_page)),
            "per_page": per_page,
            "total": total,
        },
    }


@router.post(
    "/admin/questions",
    response_model=ApiResponse[QuestionResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Add a question to the pool",
)
async def create_pool_question(
    data: CreateQuestionRequest,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    question = Question(
        text=data.text,
        category=data.category.value,
        image_url=data.image_url,
    )
    session.add(question)
    await session.commit()
    await session.refresh(question)
    return ApiResponse(data=_serialize_question(question), message="Question added to pool")


@router.patch(
    "/admin/questions/{question_id}",
    response_model=ApiResponse[QuestionResponse],
    summary="Update a pool question",
)
async def update_pool_question(
    question_id: str,
    data: UpdateQuestionRequest,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Question).where(Question.uuid == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    if data.text is not None:
        question.text = data.text
    if data.category is not None:
        question.category = data.category.value
    if data.is_active is not None:
        question.is_active = data.is_active
    question.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(question)
    return ApiResponse(data=_serialize_question(question))


@router.delete(
    "/admin/questions/{question_id}",
    response_model=ApiResponse[None],
    summary="Remove a question from the pool",
)
async def delete_pool_question(
    question_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Question).where(Question.uuid == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    await session.delete(question)
    await session.commit()
    return ApiResponse(data=None, message="Question deleted")


# ═══════════════════════════════════════════════════════════════════════════════
# Group questions
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/groups/{group_id}/questions/next",
    response_model=ApiResponse[GroupQuestionResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Send a question to a group (random or specific)",
)
async def send_question_to_group(
    group_id: str,
    data: SendQuestionToGroupRequest,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    await _require_group_admin(session, group_id, str(user.uuid))
    await _require_member(session, group_id, str(user.uuid))

    # Close any still-active question for this group
    active_result = await session.execute(
        select(GroupQuestion).where(
            GroupQuestion.group_uuid == group_id,
            GroupQuestion.status == "active",
        )
    )
    for active_gq in active_result.scalars().all():
        active_gq.status = "closed"
        active_gq.closed_at = datetime.utcnow()

    if data.question_uuid:
        # Use a specific question from the pool
        q_result = await session.execute(
            select(Question).where(
                Question.uuid == data.question_uuid,
                Question.is_active == True,
            )
        )
        question = q_result.scalar_one_or_none()
        if not question:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Question not found or inactive",
            )
    else:
        # Pick a random active question, optionally filtered by category
        filters = [Question.is_active == True]
        if data.category:
            filters.append(Question.category == data.category.value)

        pool_result = await session.execute(select(Question).where(*filters))
        pool = pool_result.scalars().all()

        if not pool:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active questions available in the pool",
            )
        question = random.choice(pool)

    gq = GroupQuestion(
        question_uuid=str(question.uuid),
        group_uuid=group_id,
        status="active",
    )
    session.add(gq)
    await session.commit()
    await session.refresh(gq)

    return ApiResponse(
        data=await _serialize_group_question(session, gq, str(user.uuid)),
        message="Question sent to group",
    )


@router.get(
    "/groups/{group_id}/questions",
    response_model=dict,
    summary="List questions sent to a group (paginated)",
)
async def list_group_questions(
    group_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    page: int = 1,
):
    result = await session.execute(
        select(Group).where(Group.uuid == group_id, Group.is_active == True)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    await _require_member(session, group_id, str(user.uuid))

    per_page = 20
    offset = (page - 1) * per_page

    total = (
        await session.execute(
            select(func.count(GroupQuestion.id)).where(GroupQuestion.group_uuid == group_id)
        )
    ).scalar_one()

    gq_result = await session.execute(
        select(GroupQuestion)
        .where(GroupQuestion.group_uuid == group_id)
        .order_by(GroupQuestion.sent_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    gqs = gq_result.scalars().all()

    data = [
        await _serialize_group_question(session, gq, str(user.uuid)) for gq in gqs
    ]

    return {
        "success": True,
        "data": data,
        "meta": {
            "current_page": page,
            "last_page": max(1, math.ceil(total / per_page)),
            "per_page": per_page,
            "total": total,
        },
    }


@router.get(
    "/groups/{group_id}/questions/active",
    response_model=ApiResponse[GroupQuestionResponse],
    summary="Get the currently active question for a group",
)
async def get_active_group_question(
    group_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Group).where(Group.uuid == group_id, Group.is_active == True)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    await _require_member(session, group_id, str(user.uuid))

    gq_result = await session.execute(
        select(GroupQuestion).where(
            GroupQuestion.group_uuid == group_id,
            GroupQuestion.status == "active",
        )
    )
    gq = gq_result.scalar_one_or_none()
    if not gq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active question for this group",
        )

    return ApiResponse(
        data=await _serialize_group_question(session, gq, str(user.uuid))
    )


@router.get(
    "/group-questions/{gq_id}",
    response_model=ApiResponse[GroupQuestionResponse],
    summary="Get a group question detail",
)
async def get_group_question(
    gq_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    gq_result = await session.execute(
        select(GroupQuestion).where(GroupQuestion.uuid == gq_id)
    )
    gq = gq_result.scalar_one_or_none()
    if not gq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    await _require_member(session, str(gq.group_uuid), str(user.uuid))
    return ApiResponse(
        data=await _serialize_group_question(session, gq, str(user.uuid))
    )


@router.post(
    "/group-questions/{gq_id}/close",
    response_model=ApiResponse[GroupQuestionResponse],
    summary="Close a group question (owner only)",
)
async def close_group_question(
    gq_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    gq_result = await session.execute(
        select(GroupQuestion).where(GroupQuestion.uuid == gq_id)
    )
    gq = gq_result.scalar_one_or_none()
    if not gq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    await _require_group_admin(session, str(gq.group_uuid), str(user.uuid))

    if gq.status == "closed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already closed")

    gq.status = "closed"
    gq.closed_at = datetime.utcnow()
    await session.commit()
    await session.refresh(gq)

    return ApiResponse(
        data=await _serialize_group_question(session, gq, str(user.uuid)),
        message="Question closed",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Answers
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/group-questions/{gq_id}/answers",
    response_model=dict,
    summary="List answers for a group question",
)
async def list_answers(
    gq_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    page: int = 1,
):
    gq_result = await session.execute(
        select(GroupQuestion).where(GroupQuestion.uuid == gq_id)
    )
    gq = gq_result.scalar_one_or_none()
    if not gq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    await _require_member(session, str(gq.group_uuid), str(user.uuid))

    per_page = 20
    offset = (page - 1) * per_page

    total = (
        await session.execute(
            select(func.count(Answer.id)).where(Answer.group_question_uuid == gq_id)
        )
    ).scalar_one()

    ans_result = await session.execute(
        select(Answer)
        .where(Answer.group_question_uuid == gq_id)
        .order_by(Answer.created_at.asc())
        .offset(offset)
        .limit(per_page)
    )
    answers = ans_result.scalars().all()

    data = []
    for ans in answers:
        author = await _get_user(session, str(ans.author_uuid))
        data.append(_serialize_answer(ans, author))

    return {
        "success": True,
        "data": data,
        "meta": {
            "current_page": page,
            "last_page": max(1, math.ceil(total / per_page)),
            "per_page": per_page,
            "total": total,
        },
    }


@router.post(
    "/answers",
    response_model=ApiResponse[AnswerResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Submit an answer to a group question",
)
async def create_answer(
    data: CreateAnswerRequest,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    gq_result = await session.execute(
        select(GroupQuestion).where(GroupQuestion.uuid == data.group_question_uuid)
    )
    gq = gq_result.scalar_one_or_none()
    if not gq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    if gq.status == "closed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This question is already closed"
        )

    await _require_member(session, str(gq.group_uuid), str(user.uuid))

    # One answer per user per group question
    existing = await session.execute(
        select(Answer).where(
            Answer.group_question_uuid == data.group_question_uuid,
            Answer.author_uuid == str(user.uuid),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="You already answered this question"
        )

    answer = Answer(
        group_question_uuid=data.group_question_uuid,
        author_uuid=str(user.uuid),
        selected_user_uuid=data.selected_user_uuid,
    )
    session.add(answer)
    gq.answer_count += 1
    await session.commit()
    await session.refresh(answer)

    author = await _get_user(session, str(user.uuid))
    return ApiResponse(data=_serialize_answer(answer, author), message="Answer saved")


@router.delete(
    "/answers/{answer_id}",
    response_model=ApiResponse[None],
    summary="Delete own answer",
)
async def delete_answer(
    answer_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Answer).where(Answer.uuid == answer_id))
    answer = result.scalar_one_or_none()
    if not answer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found")
    if str(answer.author_uuid) != str(user.uuid):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Decrement answer_count
    gq_result = await session.execute(
        select(GroupQuestion).where(GroupQuestion.uuid == answer.group_question_uuid)
    )
    gq = gq_result.scalar_one_or_none()
    if gq:
        gq.answer_count = max(0, gq.answer_count - 1)

    await session.delete(answer)
    await session.commit()
    return ApiResponse(data=None, message="Answer deleted")
