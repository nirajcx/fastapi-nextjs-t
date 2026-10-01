"""Import all mappings so Alembic sees the complete metadata."""
from app.db.models.todo import Todo

__all__ = ["Todo"]
