"""postgres: widen statement_file.parse_method (Postgres enforces VARCHAR lengths)

"layout:travel-agent-register" is 28 characters; SQLite ignored the old
limit of 20, Postgres rejects the insert.

Revision ID: 0013
Revises: 0012
Create Date: 2026-10-12 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0013'
down_revision: Union[str, Sequence[str], None] = '0012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('statement_file') as batch:
        batch.alter_column('parse_method', existing_type=sa.String(length=20),
                           type_=sa.String(length=60), existing_nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('statement_file') as batch:
        batch.alter_column('parse_method', existing_type=sa.String(length=60),
                           type_=sa.String(length=20), existing_nullable=False)
