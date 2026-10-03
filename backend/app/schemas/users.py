from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class UserCreate(BaseModel):
    """Payload for user registration."""
    email: EmailStr      # Validates standard email address format
    username: str
    password: str        # Plain-text password hashed using Argon2id in the service layer


class UserUpdate(BaseModel):
    display_name: str | None = None



class UserResponse(BaseModel):
    """
    Public user profile returned to API clients.
    Note: hashed_password is intentionally excluded for security.
    """
    id: UUID
    email: str
    username: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)  # Enable conversion directly from ORM models
