"""card page: private guest notes (site_feedback) and 'card' ratings

Revision ID: 0018
Revises: 0017
Create Date: 2026-10-13 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0018"
down_revision: Union[str, Sequence[str], None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "site_feedback",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("property_id", sa.Integer(), nullable=False),
        sa.Column("message", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["property_id"],
            ["property.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_site_feedback_property_id"), "site_feedback", ["property_id"], unique=False
    )
    with op.batch_alter_table("site_rating") as batch:
        batch.drop_constraint("site_rating_source", type_="check")
        batch.create_check_constraint("site_rating_source", "source IN ('link', 'desk', 'card')")


def downgrade() -> None:
    """Downgrade schema. Card ratings go first: the old check refuses them."""
    op.execute("DELETE FROM site_rating WHERE source = 'card'")
    with op.batch_alter_table("site_rating") as batch:
        batch.drop_constraint("site_rating_source", type_="check")
        batch.create_check_constraint("site_rating_source", "source IN ('link', 'desk')")
    op.drop_index(op.f("ix_site_feedback_property_id"), table_name="site_feedback")
    op.drop_table("site_feedback")
