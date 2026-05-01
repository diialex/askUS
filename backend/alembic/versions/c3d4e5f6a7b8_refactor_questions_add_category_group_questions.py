"""Refactor questions: add category, create group_questions, update answers

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-02 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Alter questions table ─────────────────────────────────────────────
    # Drop columns that no longer belong in the pool
    op.drop_index("ix_questions_group_uuid",  table_name="questions", if_exists=True)
    op.drop_index("ix_questions_author_uuid", table_name="questions", if_exists=True)

    op.drop_column("questions", "group_uuid")
    op.drop_column("questions", "author_uuid")
    op.drop_column("questions", "answer_count")
    op.drop_column("questions", "status")

    # Add category and is_active
    op.add_column(
        "questions",
        sa.Column(
            "category",
            sa.String(),
            nullable=False,
            server_default="general",
        ),
    )
    op.add_column(
        "questions",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.create_index("ix_questions_category", "questions", ["category"])

    # ── 2. Create group_questions table ──────────────────────────────────────
    op.create_table(
        "group_questions",
        sa.Column("id",            sa.Integer(),  primary_key=True, nullable=False),
        sa.Column("uuid",          sa.String(),   nullable=False),
        sa.Column("question_uuid", sa.String(),   nullable=False),
        sa.Column("group_uuid",    sa.String(),   nullable=False),
        sa.Column("status",        sa.String(),   nullable=False, server_default="active"),
        sa.Column("answer_count",  sa.Integer(),  nullable=False, server_default="0"),
        sa.Column("sent_at",       sa.DateTime(), nullable=False),
        sa.Column("closed_at",     sa.DateTime(), nullable=True),
        sa.Column("created_at",    sa.DateTime(), nullable=False),
    )
    op.create_index("ix_group_questions_uuid",          "group_questions", ["uuid"])
    op.create_index("ix_group_questions_question_uuid", "group_questions", ["question_uuid"])
    op.create_index("ix_group_questions_group_uuid",    "group_questions", ["group_uuid"])

    # ── 3. Alter answers table ────────────────────────────────────────────────
    # Clear existing answers (schema change is breaking)
    op.execute("DELETE FROM answers")

    op.drop_index("ix_answers_question_uuid", table_name="answers", if_exists=True)
    op.drop_column("answers", "question_uuid")
    op.drop_column("answers", "image_url")

    op.add_column(
        "answers",
        sa.Column("group_question_uuid", sa.String(), nullable=False),
    )
    op.create_index("ix_answers_group_question_uuid", "answers", ["group_question_uuid"])


def downgrade() -> None:
    # answers
    op.drop_index("ix_answers_group_question_uuid", table_name="answers")
    op.drop_column("answers", "group_question_uuid")
    op.add_column("answers", sa.Column("question_uuid", sa.String(), nullable=False, server_default=""))
    op.add_column("answers", sa.Column("image_url", sa.String(), nullable=True))
    op.create_index("ix_answers_question_uuid", "answers", ["question_uuid"])

    # group_questions
    op.drop_index("ix_group_questions_group_uuid",    table_name="group_questions")
    op.drop_index("ix_group_questions_question_uuid", table_name="group_questions")
    op.drop_index("ix_group_questions_uuid",          table_name="group_questions")
    op.drop_table("group_questions")

    # questions
    op.drop_index("ix_questions_category", table_name="questions")
    op.drop_column("questions", "is_active")
    op.drop_column("questions", "category")
    op.add_column("questions", sa.Column("status",       sa.String(),  nullable=False, server_default="open"))
    op.add_column("questions", sa.Column("answer_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("questions", sa.Column("author_uuid",  sa.String(),  nullable=False, server_default=""))
    op.add_column("questions", sa.Column("group_uuid",   sa.String(),  nullable=False, server_default=""))
    op.create_index("ix_questions_author_uuid", "questions", ["author_uuid"])
    op.create_index("ix_questions_group_uuid",  "questions", ["group_uuid"])
