"""Add questions and answers tables

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-01 21:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "questions",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("uuid", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("group_uuid", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("author_uuid", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("text", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=False),
        sa.Column("image_url", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("answer_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_questions_uuid", "questions", ["uuid"])
    op.create_index("ix_questions_group_uuid", "questions", ["group_uuid"])
    op.create_index("ix_questions_author_uuid", "questions", ["author_uuid"])

    op.create_table(
        "answers",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("uuid", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("question_uuid", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("author_uuid", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("selected_user_uuid", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("image_url", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_answers_uuid", "answers", ["uuid"])
    op.create_index("ix_answers_question_uuid", "answers", ["question_uuid"])
    op.create_index("ix_answers_author_uuid", "answers", ["author_uuid"])
    op.create_index("ix_answers_selected_user_uuid", "answers", ["selected_user_uuid"])


def downgrade() -> None:
    op.drop_index("ix_answers_selected_user_uuid", table_name="answers")
    op.drop_index("ix_answers_author_uuid", table_name="answers")
    op.drop_index("ix_answers_question_uuid", table_name="answers")
    op.drop_index("ix_answers_uuid", table_name="answers")
    op.drop_table("answers")

    op.drop_index("ix_questions_author_uuid", table_name="questions")
    op.drop_index("ix_questions_group_uuid", table_name="questions")
    op.drop_index("ix_questions_uuid", table_name="questions")
    op.drop_table("questions")
