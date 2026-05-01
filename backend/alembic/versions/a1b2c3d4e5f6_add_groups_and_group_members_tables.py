"""Add groups and group_members tables

Revision ID: a1b2c3d4e5f6
Revises: 6a81bf5e3a17
Create Date: 2026-05-01 20:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "6a81bf5e3a17"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("uuid", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column("description", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("cover_url", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("created_by", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("member_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_groups_uuid", "groups", ["uuid"])
    op.create_index("ix_groups_name", "groups", ["name"])
    op.create_index("ix_groups_created_by", "groups", ["created_by"])

    op.create_table(
        "group_members",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("group_uuid", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("user_uuid", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("role", sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default="member"),
        sa.Column("joined_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_group_members_group_uuid", "group_members", ["group_uuid"])
    op.create_index("ix_group_members_user_uuid", "group_members", ["user_uuid"])


def downgrade() -> None:
    op.drop_index("ix_group_members_user_uuid", table_name="group_members")
    op.drop_index("ix_group_members_group_uuid", table_name="group_members")
    op.drop_table("group_members")

    op.drop_index("ix_groups_created_by", table_name="groups")
    op.drop_index("ix_groups_name", table_name="groups")
    op.drop_index("ix_groups_uuid", table_name="groups")
    op.drop_table("groups")
