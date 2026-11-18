"""the Numbers quiz: a mode on questions and plays, and a spread on number answers

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-11-18 18:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, Sequence[str], None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _sqlite() -> bool:
    return op.get_bind().dialect.name == "sqlite"


def upgrade() -> None:
    # SQLite has to rebuild a table to change a unique constraint; foreign-key checks must be
    # off while the old table is dropped (PRAGMA runs outside a transaction there).
    if _sqlite():
        op.execute("PRAGMA foreign_keys=OFF")
    with op.batch_alter_table("questions") as batch:
        batch.add_column(sa.Column("mode", sa.String(10), nullable=False, server_default="speed"))
        batch.drop_constraint("uq_questions_date_slot", type_="unique")
        batch.create_unique_constraint("uq_questions_date_mode_slot", ["date", "mode", "slot"])
    with op.batch_alter_table("plays") as batch:
        batch.add_column(sa.Column("mode", sa.String(10), nullable=False, server_default="speed"))
        batch.drop_constraint("uq_plays_player_date", type_="unique")
        batch.create_unique_constraint("uq_plays_player_date_mode", ["player_id", "date", "mode"])
    op.add_column("number_answers", sa.Column("spread", sa.Numeric(8, 4), nullable=True))
    if _sqlite():
        op.execute("PRAGMA foreign_keys=ON")


def downgrade() -> None:
    if _sqlite():
        op.execute("PRAGMA foreign_keys=OFF")
    with op.batch_alter_table("number_answers") as batch:
        batch.drop_column("spread")
    op.execute("DELETE FROM plays WHERE mode <> 'speed'")
    op.execute("DELETE FROM questions WHERE mode <> 'speed'")
    with op.batch_alter_table("plays") as batch:
        batch.drop_constraint("uq_plays_player_date_mode", type_="unique")
        batch.create_unique_constraint("uq_plays_player_date", ["player_id", "date"])
        batch.drop_column("mode")
    with op.batch_alter_table("questions") as batch:
        batch.drop_constraint("uq_questions_date_mode_slot", type_="unique")
        batch.create_unique_constraint("uq_questions_date_slot", ["date", "slot"])
        batch.drop_column("mode")
    if _sqlite():
        op.execute("PRAGMA foreign_keys=ON")
