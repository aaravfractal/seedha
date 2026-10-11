"""polish build: seeded consents, room GST setting, stay invoices, guest memory

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-12 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0012'
down_revision: Union[str, Sequence[str], None] = '0011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('consent') as batch:
        batch.add_column(sa.Column('seeded', sa.Boolean(), server_default=sa.false(), nullable=False))
    with op.batch_alter_table('owner_settings') as batch:
        batch.add_column(sa.Column('room_gst_bps', sa.Integer(), nullable=True))
    op.create_table('stay_invoice',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('property_id', sa.Integer(), nullable=False),
    sa.Column('booking_id', sa.Integer(), nullable=False),
    sa.Column('fy', sa.String(length=4), nullable=False),
    sa.Column('seq', sa.Integer(), nullable=False),
    sa.Column('number', sa.String(length=32), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['booking_id'], ['booking.id'], name='fk_stay_invoice_booking_id'),
    sa.ForeignKeyConstraint(['property_id'], ['property.id'], name='fk_stay_invoice_property_id'),
    sa.PrimaryKeyConstraint('id', name='pk_stay_invoice'),
    sa.UniqueConstraint('booking_id', name='uq_stay_invoice_booking_id'),
    sa.UniqueConstraint('number', name='uq_stay_invoice_number'),
    sa.UniqueConstraint('property_id', 'fy', 'seq', name='uq_stay_invoice_property_id_fy_seq')
    )
    op.create_table('guest_memory',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('guest_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=12), nullable=False),
    sa.Column('text', sa.String(length=200), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['guest_id'], ['guest.id'], name='fk_guest_memory_guest_id'),
    sa.PrimaryKeyConstraint('id', name='pk_guest_memory')
    )
    op.create_index('ix_guest_memory_guest_id', 'guest_memory', ['guest_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_guest_memory_guest_id', table_name='guest_memory')
    op.drop_table('guest_memory')
    op.drop_table('stay_invoice')
    with op.batch_alter_table('owner_settings') as batch:
        batch.drop_column('room_gst_bps')
    with op.batch_alter_table('consent') as batch:
        batch.drop_column('seeded')
