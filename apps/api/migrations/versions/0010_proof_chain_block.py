"""proof bundle chain block (Polygon Amoy receipts)

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-11 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0010'
down_revision: Union[str, Sequence[str], None] = '0009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('proof_bundle', schema=None) as batch_op:
        batch_op.add_column(sa.Column('chain_block', sa.Integer(), nullable=True))
    # The old "written" status (never produced in practice) is now "sent".
    op.execute("UPDATE proof_bundle SET chain_status = 'sent' WHERE chain_status = 'written'")


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('proof_bundle', schema=None) as batch_op:
        batch_op.drop_column('chain_block')
