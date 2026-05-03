"""Add push_token and push_platform to users

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-05-03 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("push_token", sa.String(), nullable=True))
    op.add_column("users", sa.Column("push_platform", sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "push_platform")
    op.drop_column("users", "push_token")
