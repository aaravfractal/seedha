"""owner settings, staff invites and Pulse plan entries

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0009'
down_revision: Union[str, Sequence[str], None] = '0008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('owner_settings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('subject', sa.String(length=16), nullable=False),
    sa.Column('email', sa.String(length=120), nullable=True),
    sa.Column('business_name', sa.String(length=120), nullable=True),
    sa.Column('gstin', sa.String(length=15), nullable=True),
    sa.Column('pan', sa.String(length=10), nullable=True),
    sa.Column('address', sa.String(length=240), nullable=True),
    sa.Column('pin', sa.String(length=6), nullable=True),
    sa.Column('notify_morning', sa.Boolean(), nullable=False),
    sa.Column('notify_close', sa.Boolean(), nullable=False),
    sa.Column('notify_approvals', sa.Boolean(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name='pk_owner_settings'),
    sa.UniqueConstraint('subject', name='uq_owner_settings_subject')
    )
    op.create_table('staff_invite',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('subject', sa.String(length=16), nullable=False),
    sa.Column('name', sa.String(length=80), nullable=False),
    sa.Column('role', sa.String(length=12), nullable=False),
    sa.Column('mobile', sa.String(length=10), nullable=False),
    sa.Column('invited_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("role IN ('front_desk', 'manager', 'accounts')", name='ck_staff_invite_role'),
    sa.PrimaryKeyConstraint('id', name='pk_staff_invite'),
    sa.UniqueConstraint('subject', 'mobile', name='uq_staff_invite_subject_mobile')
    )
    with op.batch_alter_table('staff_invite', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_staff_invite_subject'), ['subject'], unique=False)

    op.create_table('plan_entry',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('property_id', sa.Integer(), nullable=False),
    sa.Column('event_key', sa.String(length=40), nullable=False),
    sa.Column('added_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['property_id'], ['property.id'], name='fk_plan_entry_property_id'),
    sa.PrimaryKeyConstraint('id', name='pk_plan_entry'),
    sa.UniqueConstraint('property_id', 'event_key', name='uq_plan_entry_property_id_event_key')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('plan_entry')
    with op.batch_alter_table('staff_invite', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_staff_invite_subject'))

    op.drop_table('staff_invite')
    op.drop_table('owner_settings')
