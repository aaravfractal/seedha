"""guest inbox messages and away text

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-10 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0008'
down_revision: Union[str, Sequence[str], None] = '0007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('inbox_away',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('property_id', sa.Integer(), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('approved_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('enabled', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['property_id'], ['property.id'], name='fk_inbox_away_property_id'),
    sa.PrimaryKeyConstraint('id', name='pk_inbox_away'),
    sa.UniqueConstraint('property_id', name='uq_inbox_away_property_id')
    )
    op.create_table('inbox_message',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('consent_id', sa.Integer(), nullable=False),
    sa.Column('direction', sa.String(length=3), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('sent_by', sa.String(length=5), nullable=False),
    sa.Column('transport', sa.String(length=12), nullable=True),
    sa.Column('provider_message_id', sa.String(length=80), nullable=True),
    sa.CheckConstraint("direction IN ('in', 'out')", name='ck_inbox_message_direction'),
    sa.CheckConstraint("sent_by IN ('guest', 'owner', 'away')", name='ck_inbox_message_sent_by'),
    sa.ForeignKeyConstraint(['consent_id'], ['consent.id'], name='fk_inbox_message_consent_id'),
    sa.PrimaryKeyConstraint('id', name='pk_inbox_message')
    )
    with op.batch_alter_table('inbox_message', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_inbox_message_consent_id'), ['consent_id'], unique=False)



def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('inbox_message', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_inbox_message_consent_id'))

    op.drop_table('inbox_message')
    op.drop_table('inbox_away')
