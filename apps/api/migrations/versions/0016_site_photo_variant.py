"""site photo variants: cached responsive AVIF, WebP and JPEG copies

Revision ID: 0016
Revises: 0015
Create Date: 2026-10-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0016'
down_revision: Union[str, Sequence[str], None] = '0015'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('site_photo_variant',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('photo_id', sa.Integer(), nullable=False),
    sa.Column('w', sa.Integer(), nullable=False),
    sa.Column('fmt', sa.String(length=8), nullable=False),
    sa.Column('width', sa.Integer(), nullable=False),
    sa.Column('height', sa.Integer(), nullable=False),
    sa.Column('source_sha256', sa.String(length=64), nullable=False),
    sa.Column('sha256', sa.String(length=64), nullable=False),
    sa.Column('data', sa.LargeBinary(), nullable=False),
    sa.ForeignKeyConstraint(['photo_id'], ['site_photo.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('photo_id', 'w', 'fmt')
    )
    op.create_index(op.f('ix_site_photo_variant_photo_id'), 'site_photo_variant', ['photo_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_site_photo_variant_photo_id'), table_name='site_photo_variant')
    op.drop_table('site_photo_variant')
