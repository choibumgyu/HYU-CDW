"""add sql_generator_log

Revision ID: dfbe45e8ec1c
Revises: 
Create Date: 2025-05-10 12:56:18.217628

"""
from typing import Sequence, Union
from sqlalchemy.sql import func

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dfbe45e8ec1c'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'sql_generator_log',
        sa.Column('log_id', sa.Integer(), autoincrement=True, nullable=False),
        # user_id와 session_id는 주석 처리되어 있으므로 포함하지 않습니다.
        # sa.Column('user_id', sa.Integer(), nullable=False), # ForeignKey는 필요에 따라 추가
        # sa.Column('session_id', sa.String(length=255), nullable=True),
        sa.Column('input_received_timestamp', sa.DateTime(),  nullable=True),
        sa.Column('user_input_text', sa.Text(), nullable=True),
        sa.Column('pre_llm_filter_status', sa.String(length=50), nullable=True),
        sa.Column('pre_llm_filter_reason', sa.Text(), nullable=True),
        sa.Column('pre_llm_filter_complete_timestamp', sa.DateTime(), nullable=True),
        sa.Column('generated_sql', sa.Text(), nullable=True),
        sa.Column('llm_request_timestamp', sa.DateTime(), nullable=True),
        sa.Column('llm_response_timestamp', sa.DateTime(), nullable=True),
        sa.Column('llm_validation_reason', sa.Text(), nullable=True),
        sa.Column('llm_model_used', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('log_id')
    )
    pass


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('sql_generator_log')
    pass
