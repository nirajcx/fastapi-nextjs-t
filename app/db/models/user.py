from datetime import datetime
from typing import TYPE_CHECKING, List
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# TYPE_CHECKING block: sirf type hints ke liye import hota hai,
# runtime pe import nahi hota — circular import se bachne ke liye.
if TYPE_CHECKING:
    from app.db.models.todo import Todo
    from app.db.models.session import AuthSession


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )
    username: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        unique=True,
        index=True,
    )
    hashed_password: Mapped[str] = mapped_column(
        String(400),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # ─── Relationships ────────────────────────────────────────────
    # Koi nayi table nahi banti — ye sirf Python-level navigation hai.
    # "todos" → Todo table ke rows jahan Todo.user_id == self.id
    # "sessions" → AuthSession table ke rows jahan AuthSession.user_id == self.id
    todos: Mapped[List["Todo"]] = relationship(
        "Todo",
        back_populates="user",
        cascade="all, delete-orphan",  # user delete ho to uske todos bhi delete
    )
    sessions: Mapped[List["AuthSession"]] = relationship(
        "AuthSession",
        back_populates="user",
        cascade="all, delete-orphan",  # user delete ho to uske sessions bhi delete
    )