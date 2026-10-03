# Alembic migrations

Run from the project root with the correct local DATABASE_URL:

```bash
python -m alembic upgrade head
python -m alembic current
python -m alembic check
```

The historical 0001_initial revision stays unchanged for previously initialized databases. The new 0002_personal_todos revision preserves todos and owners, creates the direct todos.owner_id → users.id foreign key, replaces the index, removes tenant_id, and drops membership/workspace tables.

Both new installations and existing databases use `upgrade head`. The migration was tested with existing todos from two former workspaces and verified to preserve their IDs, owners, and contents. It has not been applied automatically to your regular database.

Workspace metadata is intentionally removed. Back it up before upgrading if needed. Downgrading 0002 is explicitly refused because recreating empty groups would falsely imply the original relationships were restored. Restore a pre-upgrade backup for that scenario. Future migrations should still be generated/reviewed and tested against disposable databases before deployment. Update readiness's expected revision with future changes.
