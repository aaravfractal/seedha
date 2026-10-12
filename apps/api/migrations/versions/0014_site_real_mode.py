"""site real mode: address slug and branding, owner photos, content, generation runs

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-12 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0014'
down_revision: Union[str, Sequence[str], None] = '0013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('site_config') as batch:
        batch.add_column(sa.Column('slug', sa.String(length=40), nullable=True))
        batch.add_column(sa.Column('previous_slug', sa.String(length=40), nullable=True))
        batch.add_column(sa.Column('slug_changed_at', sa.DateTime(timezone=True), nullable=True))
        batch.add_column(
            sa.Column('hide_branding', sa.Boolean(), server_default=sa.false(), nullable=False)
        )
        batch.create_unique_constraint('uq_site_config_slug', ['slug'])
    op.create_table('site_photo',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('property_id', sa.Integer(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('content_type', sa.String(length=20), nullable=False),
    sa.Column('width', sa.Integer(), nullable=False),
    sa.Column('height', sa.Integer(), nullable=False),
    sa.Column('size_bytes', sa.Integer(), nullable=False),
    sa.Column('sha256', sa.String(length=64), nullable=False),
    sa.Column('data', sa.LargeBinary(), nullable=False),
    sa.Column('caption_en', sa.String(length=80), nullable=False),
    sa.Column('caption_hi', sa.String(length=120), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['property_id'], ['property.id'], name='fk_site_photo_property_id'),
    sa.PrimaryKeyConstraint('id', name='pk_site_photo')
    )
    op.create_index('ix_site_photo_property_id', 'site_photo', ['property_id'], unique=False)
    op.create_table('site_content',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('property_id', sa.Integer(), nullable=False),
    sa.Column('owner_description', sa.Text(), nullable=False),
    sa.Column('rooms_json', sa.Text(), nullable=False),
    sa.Column('content_json', sa.Text(), nullable=False),
    sa.Column('source', sa.String(length=12), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['property_id'], ['property.id'], name='fk_site_content_property_id'),
    sa.PrimaryKeyConstraint('id', name='pk_site_content'),
    sa.UniqueConstraint('property_id', name='uq_site_content_property_id')
    )
    op.create_table('site_gen_run',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('property_id', sa.Integer(), nullable=False),
    sa.Column('at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('model', sa.String(length=60), nullable=False),
    sa.Column('input_tokens', sa.Integer(), nullable=False),
    sa.Column('output_tokens', sa.Integer(), nullable=False),
    sa.Column('cache_creation_tokens', sa.Integer(), nullable=False),
    sa.Column('cache_read_tokens', sa.Integer(), nullable=False),
    sa.Column('fields_fallback', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['property_id'], ['property.id'], name='fk_site_gen_run_property_id'),
    sa.PrimaryKeyConstraint('id', name='pk_site_gen_run')
    )
    op.create_index('ix_site_gen_run_property_id', 'site_gen_run', ['property_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_site_gen_run_property_id', table_name='site_gen_run')
    op.drop_table('site_gen_run')
    op.drop_table('site_content')
    op.drop_index('ix_site_photo_property_id', table_name='site_photo')
    op.drop_table('site_photo')
    with op.batch_alter_table('site_config') as batch:
        batch.drop_constraint('uq_site_config_slug', type_='unique')
        batch.drop_column('hide_branding')
        batch.drop_column('slug_changed_at')
        batch.drop_column('previous_slug')
        batch.drop_column('slug')
