"""site ratings: one-time verified-guest rating tokens and their ratings

Revision ID: 0017
Revises: 0016
Create Date: 2026-10-13 15:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0017"
down_revision: Union[str, Sequence[str], None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "site_rating",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("property_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("source", sa.String(length=8), nullable=False),
        sa.Column("source_ref", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("opens_on", sa.Date(), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stars", sa.Integer(), nullable=True),
        sa.Column("comment", sa.String(length=200), nullable=False),
        sa.Column("hidden", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.CheckConstraint("source IN ('link', 'desk')", name="site_rating_source"),
        sa.CheckConstraint("stars IS NULL OR stars BETWEEN 1 AND 5", name="site_rating_stars"),
        sa.ForeignKeyConstraint(
            ["property_id"],
            ["property.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source", "source_ref"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(
        op.f("ix_site_rating_property_id"), "site_rating", ["property_id"], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_site_rating_property_id"), table_name="site_rating")
    op.drop_table("site_rating")
