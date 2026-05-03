import math
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser
from app.db.database import get_session
from app.models.group import Group, GroupMember
from app.models.user import User
from app.schemas.base import ApiResponse
from app.schemas.group import CreateGroupRequest, GroupResponse, InviteResponse

router = APIRouter(prefix="/groups", tags=["Groups"])


def _serialize(group: Group, is_member: bool, include_invite: bool = False) -> GroupResponse:
    return GroupResponse(
        id=str(group.uuid),
        name=group.name,
        description=group.description,
        cover_url=group.cover_url,
        member_count=group.member_count,
        is_member=is_member,
        created_by=str(group.created_by),
        invite_code=group.invite_code if include_invite else None,
        created_at=group.created_at.isoformat(),
        updated_at=group.updated_at.isoformat() if group.updated_at else None,
    )


async def _is_member(session: AsyncSession, group_uuid: str, user_uuid: str) -> bool:
    result = await session.execute(
        select(GroupMember).where(
            GroupMember.group_uuid == group_uuid,
            GroupMember.user_uuid == user_uuid,
        )
    )
    return result.scalar_one_or_none() is not None


@router.get("", name="list_groups", response_model=dict, summary="List user groups")
async def list_groups(
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    page: int = 1,
):
    per_page = 20
    offset = (page - 1) * per_page

    memberships_result = await session.execute(
        select(GroupMember.group_uuid).where(GroupMember.user_uuid == user.uuid)
    )
    member_uuids = memberships_result.scalars().all()

    if not member_uuids:
        return {"data": [], "meta": {"current_page": page, "last_page": 1, "per_page": per_page, "total": 0}}

    total_result = await session.execute(
        select(func.count(Group.id)).where(Group.uuid.in_(member_uuids), Group.is_active == True)
    )
    total = total_result.scalar_one()

    groups_result = await session.execute(
        select(Group)
        .where(Group.uuid.in_(member_uuids), Group.is_active == True)
        .order_by(Group.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    groups = groups_result.scalars().all()

    return {
        "data": [_serialize(g, True) for g in groups],
        "meta": {
            "current_page": page,
            "last_page": max(1, math.ceil(total / per_page)),
            "per_page": per_page,
            "total": total,
        },
    }


@router.get("/search", name="search_groups", response_model=dict, summary="Search public groups")
async def search_groups(
    user: CurrentUser,
    q: str,
    session: AsyncSession = Depends(get_session),
    page: int = 1,
):
    per_page = 20
    offset = (page - 1) * per_page

    memberships_result = await session.execute(
        select(GroupMember.group_uuid).where(GroupMember.user_uuid == user.uuid)
    )
    member_uuids = set(memberships_result.scalars().all())

    total_result = await session.execute(
        select(func.count(Group.id)).where(Group.name.ilike(f"%{q}%"), Group.is_active == True)
    )
    total = total_result.scalar_one()

    groups_result = await session.execute(
        select(Group)
        .where(Group.name.ilike(f"%{q}%"), Group.is_active == True)
        .order_by(Group.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    groups = groups_result.scalars().all()

    return {
        "data": [_serialize(g, g.uuid in member_uuids) for g in groups],
        "meta": {
            "current_page": page,
            "last_page": max(1, math.ceil(total / per_page)),
            "per_page": per_page,
            "total": total,
        },
    }


@router.post(
    "",
    name="create_group",
    response_model=ApiResponse[GroupResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create group",
)
async def create_group(
    data: CreateGroupRequest,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    group = Group(
        name=data.name,
        description=data.description,
        cover_url=data.cover_url,
        created_by=str(user.uuid),
        member_count=1,
    )
    session.add(group)
    await session.flush()

    session.add(GroupMember(group_uuid=group.uuid, user_uuid=str(user.uuid), role="admin"))
    await session.commit()
    await session.refresh(group)

    return ApiResponse(data=_serialize(group, True), message="Group created successfully")


@router.get("/{group_id}", name="get_group", response_model=ApiResponse[GroupResponse], summary="Get group detail")
async def get_group(
    group_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Group).where(Group.uuid == group_id, Group.is_active == True))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    is_mem = await _is_member(session, group.uuid, str(user.uuid))
    return ApiResponse(data=_serialize(group, is_mem))


@router.put("/{group_id}", name="update_group", response_model=ApiResponse[GroupResponse], summary="Update group")
async def update_group(
    group_id: str,
    data: CreateGroupRequest,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Group).where(Group.uuid == group_id, Group.is_active == True))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if group.created_by != str(user.uuid):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    group.name = data.name
    group.description = data.description
    group.cover_url = data.cover_url
    group.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(group)

    return ApiResponse(data=_serialize(group, True))


@router.delete("/{group_id}", name="delete_group", response_model=ApiResponse[None], summary="Delete group")
async def delete_group(
    group_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Group).where(Group.uuid == group_id, Group.is_active == True))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if group.created_by != str(user.uuid):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    group.is_active = False
    group.updated_at = datetime.utcnow()
    await session.commit()

    return ApiResponse(data=None, message="Group deleted")


@router.post("/{group_id}/join", name="join_group", response_model=ApiResponse[None], summary="Join group")
async def join_group(
    group_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Group).where(Group.uuid == group_id, Group.is_active == True))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    if await _is_member(session, group.uuid, str(user.uuid)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already a member")

    session.add(GroupMember(group_uuid=group.uuid, user_uuid=str(user.uuid), role="member"))
    group.member_count += 1
    group.updated_at = datetime.utcnow()
    await session.commit()

    return ApiResponse(data=None, message="Joined group")


@router.post("/{group_id}/leave", name="leave_group", response_model=ApiResponse[None], summary="Leave group")
async def leave_group(
    group_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Group).where(Group.uuid == group_id, Group.is_active == True))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    mem_result = await session.execute(
        select(GroupMember).where(
            GroupMember.group_uuid == group.uuid,
            GroupMember.user_uuid == str(user.uuid),
        )
    )
    member = mem_result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not a member")

    await session.delete(member)
    group.member_count = max(0, group.member_count - 1)
    group.updated_at = datetime.utcnow()
    await session.commit()

    return ApiResponse(data=None, message="Left group")


# ── Invitaciones ──────────────────────────────────────────────────────────────

@router.get(
    "/{group_id}/invite",
    name="get_invite",
    response_model=ApiResponse[InviteResponse],
    summary="Obtener enlace/código de invitación del grupo",
)
async def get_invite(
    group_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Group).where(Group.uuid == group_id, Group.is_active == True))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if not await _is_member(session, group.uuid, str(user.uuid)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member")

    return ApiResponse(data=InviteResponse(
        invite_code=group.invite_code,
        invite_url=f"askus://join/{group.invite_code}",
    ))


@router.post(
    "/join-by-code/{code}",
    name="join_by_code",
    response_model=ApiResponse[GroupResponse],
    summary="Unirse a un grupo por código de invitación",
)
async def join_by_code(
    code: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Group).where(Group.invite_code == code.upper(), Group.is_active == True)
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Código de invitación no válido")

    if await _is_member(session, group.uuid, str(user.uuid)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ya eres miembro de este grupo")

    session.add(GroupMember(group_uuid=group.uuid, user_uuid=str(user.uuid), role="member"))
    group.member_count += 1
    group.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(group)

    return ApiResponse(data=_serialize(group, True), message="¡Te uniste al grupo!")


@router.post(
    "/{group_id}/vote-category",
    name="vote_category",
    response_model=ApiResponse[None],
    summary="Votar por la temática de la próxima pregunta (recompensa por anuncio)",
)
async def vote_category(
    group_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    category: str = "general",
):
    """
    Guarda la categoría preferida para la próxima pregunta del grupo.
    Se llama tras ver un anuncio recompensado en el cliente.
    Categorías válidas: picante, incomoda, graciosa, general.
    """
    valid = {"picante", "incomoda", "graciosa", "general"}
    if category not in valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Categoría no válida. Elige entre: {', '.join(valid)}",
        )

    result = await session.execute(select(Group).where(Group.uuid == group_id, Group.is_active == True))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    if not await _is_member(session, group.uuid, str(user.uuid)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member")

    group.next_question_category = category
    group.updated_at = datetime.utcnow()
    await session.commit()

    labels = {"picante": "🌶️ Picante", "incomoda": "😬 Incómoda", "graciosa": "😂 Graciosa", "general": "🎲 General"}
    return ApiResponse(data=None, message=f"¡Temática guardada! Mañana la pregunta será {labels[category]}")


@router.get("/{group_id}/members", name="list_members", response_model=dict, summary="List group members")
async def list_members(
    group_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    page: int = 1,
):
    result = await session.execute(select(Group).where(Group.uuid == group_id, Group.is_active == True))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    per_page = 20
    offset = (page - 1) * per_page

    total_result = await session.execute(
        select(func.count(GroupMember.id)).where(GroupMember.group_uuid == group_id)
    )
    total = total_result.scalar_one()

    members_result = await session.execute(
        select(GroupMember)
        .where(GroupMember.group_uuid == group_id)
        .offset(offset)
        .limit(per_page)
    )
    members = members_result.scalars().all()

    data = []
    for m in members:
        u_result = await session.execute(select(User).where(User.uuid == m.user_uuid))
        u = u_result.scalar_one_or_none()
        data.append({
            "user_id": m.user_uuid,
            "name": u.username if u else "Unknown",
            "avatar_url": None,
            "role": m.role,
            "joined_at": m.joined_at.isoformat(),
        })

    return {
        "data": data,
        "meta": {
            "current_page": page,
            "last_page": max(1, math.ceil(total / per_page)),
            "per_page": per_page,
            "total": total,
        },
    }
