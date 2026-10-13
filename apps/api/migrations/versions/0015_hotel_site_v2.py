"""hotel site v2: owner site details and printed card scan counts

Revision ID: 0015
Revises: 0014
Create Date: 2026-10-13 06:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0015'
down_revision: Union[str, Sequence[str], None] = '0014'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('site_details',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('property_id', sa.Integer(), nullable=False),
    sa.Column('details_json', sa.Text(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['property_id'], ['property.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('property_id')
    )
    op.create_table('site_card_scan',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('property_id', sa.Integer(), nullable=False),
    sa.Column('card', sa.String(length=8), nullable=False),
    sa.Column('day', sa.Date(), nullable=False),
    sa.Column('count', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['property_id'], ['property.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('property_id', 'card', 'day')
    )
    op.create_index(op.f('ix_site_card_scan_property_id'), 'site_card_scan', ['property_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_site_card_scan_property_id'), table_name='site_card_scan')
    op.drop_table('site_card_scan')
    op.drop_table('site_details')
