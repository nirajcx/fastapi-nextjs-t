"""Remove workspaces while preserving every todo and its user ownership.

Historical revision 0001 stays unchanged for databases that already applied it.
Grouping metadata is intentionally removed; restoring it requires a backup.
"""

from alembic import op

revision = "0002_personal_todos"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("fk_todos_tenant_id_memberships", "todos", type_="foreignkey")
    op.create_foreign_key(
        "fk_todos_owner_id_users", "todos", "users", ["owner_id"], ["id"], ondelete="RESTRICT"
    )
    op.drop_index("ix_todos_scope_created", table_name="todos")
    op.create_index("ix_todos_owner_created", "todos", ["owner_id", "created_at", "id"])
    op.drop_column("todos", "tenant_id")
    op.drop_table("memberships")
    op.drop_table("tenants")


def downgrade() -> None:
    raise NotImplementedError(
        "Workspace grouping was removed. Restore a pre-upgrade backup instead of inventing lost memberships."
    )
