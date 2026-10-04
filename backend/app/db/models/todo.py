from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.user import User


class Todo(Base):
    __tablename__ = "todos"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    # Foreign key referencing the users table with cascade delete
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # ─── S3 Attachment Fields ──────────────────────────────────────────────────
    # attachment_key  : the S3 object path, e.g. "users/{uid}/todos/{uuid}.png"
    # attachment_name : original file name the user selected, shown in the UI
    # attachment_size : file size in bytes for display (e.g. "2.3 MB")
    # attachment_content_type : MIME type, used to decide how to render the file
    attachment_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    attachment_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    attachment_size: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    attachment_content_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # ─── Relationship ──────────────────────────────────────────────
    # Linked to User.todos
    user: Mapped["User"] = relationship("User", back_populates="todos")

