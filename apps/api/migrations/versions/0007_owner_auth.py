"""owner accounts and OTP challenges

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-10 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0007'
down_revision: Union[str, Sequence[str], None] = '0006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('owner_account',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=80), nullable=False),
    sa.Column('hotel_name', sa.String(length=120), nullable=False),
    sa.Column('phone', sa.String(length=10), nullable=False),
    sa.Column('terms_accepted_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updates_opt_in', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('property_name', sa.String(length=120), nullable=True),
    sa.Column('town', sa.String(length=80), nullable=True),
    sa.Column('rooms', sa.Integer(), nullable=True),
    sa.Column('contracts', sa.String(length=200), nullable=True),
    sa.Column('cost_per_room', sa.BigInteger(), nullable=True),
    sa.Column('whatsapp_connected_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('onboarded_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint('rooms BETWEEN 1 AND 500', name='ck_owner_account_rooms'),
    sa.CheckConstraint('cost_per_room IS NULL OR cost_per_room >= 0', name='ck_owner_account_cost'),
    sa.PrimaryKeyConstraint('id', name='pk_owner_account'),
    sa.UniqueConstraint('phone', name='uq_owner_account_phone')
    )
    op.create_table('otp_challenge',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('phone', sa.String(length=10), nullable=False),
    sa.Column('code_hash', sa.String(length=64), nullable=False),
    sa.Column('salt', sa.String(length=32), nullable=False),
    sa.Column('attempts', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_sent_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True),
    sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id', name='pk_otp_challenge'),
    sa.UniqueConstraint('phone', name='uq_otp_challenge_phone')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('otp_challenge')
    op.drop_table('owner_account')
