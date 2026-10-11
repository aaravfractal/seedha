"""owner events pasted from official sources (Event Radar Lite)

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-11 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0011'
down_revision: Union[str, Sequence[str], None] = '0010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('owner_event',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('property_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=80), nullable=False),
    sa.Column('start_date', sa.Date(), nullable=False),
    sa.Column('end_date', sa.Date(), nullable=False),
    sa.Column('town', sa.String(length=60), nullable=False),
    sa.Column('category', sa.String(length=16), nullable=False),
    sa.Column('demand', sa.String(length=8), nullable=False),
    sa.Column('source_url', sa.String(length=500), nullable=False),
    sa.Column('origin', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['property_id'], ['property.id'], name='fk_owner_event_property_id'),
    sa.PrimaryKeyConstraint('id', name='pk_owner_event'),
    sa.UniqueConstraint('property_id', 'name', 'start_date', name='uq_owner_event_property_id_name_start_date')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('owner_event')
