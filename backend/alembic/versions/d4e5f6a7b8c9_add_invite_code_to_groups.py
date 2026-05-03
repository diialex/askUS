"""Add invite_code to groups

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-03 00:00:00.000000
"""
from typing import Sequence, Union
import random
import string

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _rand_code() -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))


def upgrade() -> None:
    op.add_column(
        "groups",
        sa.Column("invite_code", sa.String(), nullable=False, server_default="XXXXXXXX"),
    )
    op.create_index("ix_groups_invite_code", "groups", ["invite_code"])

    # Assign unique invite codes to existing groups
    conn = op.get_bind()
    groups = conn.execute(sa.text("SELECT uuid FROM groups")).fetchall()
    for (group_uuid,) in groups:
        code = _rand_code()
        conn.execute(
            sa.text("UPDATE groups SET invite_code = :code WHERE uuid = :uuid"),
            {"code": code, "uuid": group_uuid},
        )


def downgrade() -> None:
    op.drop_index("ix_groups_invite_code", table_name="groups")
    op.drop_column("groups", "invite_code")
