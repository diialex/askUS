import math
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser
from app.db.database import get_session
from app.models.group import Group, GroupMember
from app.models.question import Answer, Question
from app.models.user import User
from app.schemas.base import ApiResponse
from app.schemas.question import (
    AnswerResponse,
    AuthorInfo,
    CreateAnswerRequest,
    CreateQuestionRequest,
    QuestionResponse,
)

router = APIRouter(tags=["Questions"])


# ── helpers ───────────────────────────────────────────────────────────────────

async def _get_user(session: AsyncSession, user_uuid: str) -> User | None:
    result = await session.execute(select(User).where(User.uuid == user_uuid))
    return result.scalar_one_or_none()


def _author(user: User | None) -> AuthorInfo:
    if user is None:
        return AuthorInfo(id="", name="Unknown")
    return AuthorInfo(id=str(user.uuid), name=user.username, avatar_url=None)


def _serialize_answer(answer: Answer, author: User | None) -> AnswerResponse:
    return AnswerResponse(
        id=str(answer.uuid),
        question_id=str(answer.question_uuid),
        author=_author(author),
        text=answer.selected_user_uuid,
        image_url=answer.image_url,
        created_at=answer.created_at.isoformat(),
        updated_at=answer.updated_at.isoformat() if answer.updated_at else None,
    )


async def _serialize_question(
    session: AsyncSession,
    question: Question,
    current_user_uuid: str,
) -> QuestionResponse:
    author = await _get_user(session, question.author_uuid)

    # my_answer for the current user
    my_ans_result = await session.execute(
        select(Answer).where(
            Answer.question_uuid == question.uuid,
            Answer.author_uuid == current_user_uuid,
        )
    )
    my_ans = my_ans_result.scalar_one_or_none()
    my_answer_resp = None
    if my_ans:
        ans_author = await _get_user(session, my_ans.author_uuid)
        my_answer_resp = _serialize_answer(my_ans, ans_author)

    return QuestionResponse(
        id=str(question.uuid),
        group_id=str(question.group_uuid),
        author=_author(author),
        text=question.text,
        image_url=question.image_url,
        answer_count=question.answer_count,
        my_answer=my_answer_resp,
        status=question.status,
        created_at=question.created_at.isoformat(),
        updated_at=question.updated_at.isoformat() if question.updated_at else None,
    )


async def _require_member(session: AsyncSession, group_uuid: str, user_uuid: str) -> None:
    result = await session.execute(
        select(GroupMember).where(
            GroupMember.group_uuid == group_uuid,
            GroupMember.user_uuid == user_uuid,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a group member")


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get(
    "/groups/{group_id}/questions",
    name="list_questions",
    response_model=dict,
    summary="List questions in a group",
)
async def list_questions(
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

    total = (await session.execute(
        select(func.count(Question.id)).where(Question.group_uuid == group_id)
    )).scalar_one()

    questions_result = await session.execute(
        select(Question)
        .where(Question.group_uuid == group_id)
        .order_by(Question.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    questions = questions_result.scalars().all()

    data = [await _serialize_question(session, q, str(user.uuid)) for q in questions]

    return {
        "data": data,
        "meta": {
            "current_page": page,
            "last_page": max(1, math.ceil(total / per_page)),
            "per_page": per_page,
            "total": total,
        },
    }


@router.get(
    "/questions/{question_id}",
    name="get_question",
    response_model=ApiResponse[QuestionResponse],
    summary="Get question detail",
)
async def get_question(
    question_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Question).where(Question.uuid == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    await _require_member(session, question.group_uuid, str(user.uuid))
    return ApiResponse(data=await _serialize_question(session, question, str(user.uuid)))


@router.post(
    "/questions",
    name="create_question",
    response_model=ApiResponse[QuestionResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create question",
)
async def create_question(
    data: CreateQuestionRequest,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Group).where(Group.uuid == data.group_id, Group.is_active == True)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    await _require_member(session, data.group_id, str(user.uuid))

    question = Question(
        group_uuid=data.group_id,
        author_uuid=str(user.uuid),
        text=data.text,
        image_url=data.image_url,
    )
    session.add(question)
    await session.commit()
    await session.refresh(question)

    return ApiResponse(
        data=await _serialize_question(session, question, str(user.uuid)),
        message="Question created",
    )


@router.delete(
    "/questions/{question_id}",
    name="delete_question",
    response_model=ApiResponse[None],
    summary="Delete question",
)
async def delete_question(
    question_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Question).where(Question.uuid == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    if question.author_uuid != str(user.uuid):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    await session.delete(question)
    await session.commit()
    return ApiResponse(data=None, message="Question deleted")


@router.get(
    "/questions/{question_id}/answers",
    name="list_answers",
    response_model=dict,
    summary="List answers for a question",
)
async def list_answers(
    question_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    page: int = 1,
):
    q_result = await session.execute(select(Question).where(Question.uuid == question_id))
    question = q_result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    await _require_member(session, question.group_uuid, str(user.uuid))

    per_page = 20
    offset = (page - 1) * per_page

    total = (await session.execute(
        select(func.count(Answer.id)).where(Answer.question_uuid == question_id)
    )).scalar_one()

    answers_result = await session.execute(
        select(Answer)
        .where(Answer.question_uuid == question_id)
        .order_by(Answer.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    answers = answers_result.scalars().all()

    data = []
    for ans in answers:
        author = await _get_user(session, ans.author_uuid)
        data.append(_serialize_answer(ans, author))

    return {
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
    name="create_answer",
    response_model=ApiResponse[AnswerResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Answer a question",
)
async def create_answer(
    data: CreateAnswerRequest,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    q_result = await session.execute(select(Question).where(Question.uuid == data.question_id))
    question = q_result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    if question.status == "closed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question is closed")

    await _require_member(session, question.group_uuid, str(user.uuid))

    # one answer per user per question
    existing = await session.execute(
        select(Answer).where(
            Answer.question_uuid == data.question_id,
            Answer.author_uuid == str(user.uuid),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already answered")

    answer = Answer(
        question_uuid=data.question_id,
        author_uuid=str(user.uuid),
        selected_user_uuid=data.text,  # text = uuid of the selected user
        image_url=data.image_url,
    )
    session.add(answer)
    question.answer_count += 1
    await session.commit()
    await session.refresh(answer)

    author = await _get_user(session, str(user.uuid))
    return ApiResponse(data=_serialize_answer(answer, author), message="Answer saved")


@router.put(
    "/answers/{answer_id}",
    name="update_answer",
    response_model=ApiResponse[AnswerResponse],
    summary="Update answer",
)
async def update_answer(
    answer_id: str,
    data: dict,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Answer).where(Answer.uuid == answer_id))
    answer = result.scalar_one_or_none()
    if not answer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found")
    if answer.author_uuid != str(user.uuid):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    answer.selected_user_uuid = data.get("text", answer.selected_user_uuid)
    answer.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(answer)

    author = await _get_user(session, str(user.uuid))
    return ApiResponse(data=_serialize_answer(answer, author))


@router.delete(
    "/answers/{answer_id}",
    name="delete_answer",
    response_model=ApiResponse[None],
    summary="Delete answer",
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
    if answer.author_uuid != str(user.uuid):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # decrement answer_count on the question
    q_result = await session.execute(select(Question).where(Question.uuid == answer.question_uuid))
    question = q_result.scalar_one_or_none()
    if question:
        question.answer_count = max(0, question.answer_count - 1)

    await session.delete(answer)
    await session.commit()
    return ApiResponse(data=None, message="Answer deleted")
