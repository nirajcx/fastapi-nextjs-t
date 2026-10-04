"""add_attachment_fields_to_todos

Revision ID: a1b2c3d4e5f6
Revises: 50b2771a55b9
Create Date: 2026-10-04

Adds four nullable S3 attachment columns to the todos table:
  - attachment_key          : S3 object path (e.g. "users/<uid>/todos/<uuid>.png")
  - attachment_name         : original filename shown in the UI
  - attachment_size         : file size in bytes (BIGINT for large files)
  - attachment_content_type : MIME type (e.g. "image/png", "application/pdf")

All columns are nullable so existing todos without attachments are unaffected.
"""
from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = '50b2771a55b9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('todos', sa.Column('attachment_key', sa.String(length=512), nullable=True))
    op.add_column('todos', sa.Column('attachment_name', sa.String(length=255), nullable=True))
    op.add_column('todos', sa.Column('attachment_size', sa.BigInteger(), nullable=True))
    op.add_column('todos', sa.Column('attachment_content_type', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('todos', 'attachment_content_type')
    op.drop_column('todos', 'attachment_size')
    op.drop_column('todos', 'attachment_name')
    op.drop_column('todos', 'attachment_key')
