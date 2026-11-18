"""add days.restart, for deliberately restarting a played day

Revision ID: b7c1e2d3f4a5
Revises: 6aa76ee88af9
Create Date: 2026-11-18 12:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b7c1e2d3f4a5"
down_revision: Union[str, Sequence[str], None] = "6aa76ee88af9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("days") as batch:
        batch.add_column(sa.Column("restart", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    with op.batch_alter_table("days") as batch:
        batch.drop_column("restart")
