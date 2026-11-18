"""social features: sync codes, challenge codes and private leagues

Revision ID: c4d5e6f7a8b9
Revises: b7c1e2d3f4a5
Create Date: 2026-11-18 15:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, Sequence[str], None] = "b7c1e2d3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Plain ADD COLUMN plus a unique index: no table rebuild, so SQLite's foreign keys are
    # untouched, and it behaves the same on Postgres.
    op.add_column("players", sa.Column("sync_code", sa.String(16), nullable=True))
    op.create_index("uq_players_sync_code", "players", ["sync_code"], unique=True)
    op.add_column("plays", sa.Column("challenge_code", sa.String(12), nullable=True))
    op.create_index("uq_plays_challenge_code", "plays", ["challenge_code"], unique=True)
    op.create_table(
        "leagues",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(12), nullable=False),
        sa.Column("name", sa.String(40), nullable=False),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("players.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_table(
        "league_members",
        sa.Column(
            "league_id", sa.Integer(), sa.ForeignKey("leagues.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("player_id", sa.String(36), sa.ForeignKey("players.id"), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("league_id", "player_id"),
    )
    op.create_index("ix_league_members_player_id", "league_members", ["player_id"])


def downgrade() -> None:
    op.drop_index("ix_league_members_player_id", table_name="league_members")
    op.drop_table("league_members")
    op.drop_table("leagues")
    op.drop_index("uq_plays_challenge_code", table_name="plays")
    with op.batch_alter_table("plays") as batch:
        batch.drop_column("challenge_code")
    op.drop_index("uq_players_sync_code", table_name="players")
    with op.batch_alter_table("players") as batch:
        batch.drop_column("sync_code")
