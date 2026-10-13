"""guest feedback (card page form), reward settings, hotel-funded discount on savings

Revision ID: 0019
Revises: 0018
Create Date: 2026-10-13 20:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0019"
down_revision: Union[str, Sequence[str], None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_FORMULA = "net_saving = commission_avoided + gst_avoided - upi_fee"
NEW_FORMULA = "net_saving = commission_avoided + gst_avoided - upi_fee - hotel_discount"


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("perk_code") as batch:
        batch.alter_column("guest_id", existing_type=sa.Integer(), nullable=True)
        batch.alter_column("origin_booking_id", existing_type=sa.Integer(), nullable=True)
    with op.batch_alter_table("saving") as batch:
        batch.add_column(
            sa.Column("hotel_discount", sa.BigInteger(), server_default="0", nullable=False)
        )
        batch.drop_constraint("saving_formula", type_="check")
        batch.create_check_constraint("saving_formula", NEW_FORMULA)
    with op.batch_alter_table("site_config") as batch:
        batch.add_column(
            sa.Column("reward_breakfast", sa.Boolean(), server_default=sa.true(), nullable=False)
        )
        batch.add_column(
            sa.Column("reward_pct5", sa.Boolean(), server_default=sa.false(), nullable=False)
        )
        batch.add_column(
            sa.Column("reward_flat100", sa.Boolean(), server_default=sa.false(), nullable=False)
        )
    op.create_table(
        "guest_feedback",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("property_id", sa.Integer(), nullable=False),
        sa.Column("booking_id", sa.Integer(), nullable=True),
        sa.Column("verified", sa.Boolean(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("phone", sa.String(length=16), nullable=True),
        sa.Column("consent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consent_wording_version", sa.String(length=20), nullable=True),
        sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("overall", sa.Integer(), nullable=False),
        sa.Column("food", sa.Integer(), nullable=True),
        sa.Column("review", sa.String(length=500), nullable=False),
        sa.Column("reward", sa.String(length=10), nullable=False),
        sa.Column("perk_code_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=12), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "reward IN ('breakfast', 'pct5', 'flat100', 'none')", name="guest_feedback_reward"
        ),
        sa.CheckConstraint(
            "status IN ('new', 'reward_sent', 'hidden')", name="guest_feedback_status"
        ),
        sa.CheckConstraint("overall BETWEEN 1 AND 5", name="guest_feedback_overall"),
        sa.CheckConstraint("food IS NULL OR food BETWEEN 1 AND 5", name="guest_feedback_food"),
        sa.CheckConstraint(
            "phone IS NULL OR consent_at IS NOT NULL", name="guest_feedback_phone_consent"
        ),
        sa.ForeignKeyConstraint(["property_id"], ["property.id"]),
        sa.ForeignKeyConstraint(["booking_id"], ["booking.id"]),
        sa.ForeignKeyConstraint(["perk_code_id"], ["perk_code.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("booking_id", name="uq_guest_feedback_booking_id"),
        sa.UniqueConstraint("perk_code_id"),
    )
    op.create_index(
        op.f("ix_guest_feedback_property_id"), "guest_feedback", ["property_id"], unique=False
    )


def downgrade() -> None:
    """Downgrade schema. Feedback goes; reward codes without a stay go (the old
    columns require one); savings fall back to the old formula."""
    op.drop_index(op.f("ix_guest_feedback_property_id"), table_name="guest_feedback")
    op.drop_table("guest_feedback")
    orphan = "SELECT id FROM perk_code WHERE guest_id IS NULL OR origin_booking_id IS NULL"
    op.execute(f"UPDATE direct_booking SET perk_code_id = NULL WHERE perk_code_id IN ({orphan})")
    op.execute(f"DELETE FROM message WHERE perk_code_id IN ({orphan})")
    op.execute("DELETE FROM perk_code WHERE guest_id IS NULL OR origin_booking_id IS NULL")
    with op.batch_alter_table("perk_code") as batch:
        batch.alter_column("guest_id", existing_type=sa.Integer(), nullable=False)
        batch.alter_column("origin_booking_id", existing_type=sa.Integer(), nullable=False)
    with op.batch_alter_table("site_config") as batch:
        batch.drop_column("reward_flat100")
        batch.drop_column("reward_pct5")
        batch.drop_column("reward_breakfast")
    op.execute("UPDATE saving SET net_saving = commission_avoided + gst_avoided - upi_fee")
    with op.batch_alter_table("saving") as batch:
        batch.drop_constraint("saving_formula", type_="check")
        batch.create_check_constraint("saving_formula", OLD_FORMULA)
        batch.drop_column("hotel_discount")
