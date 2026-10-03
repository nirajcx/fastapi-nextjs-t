from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr


class UserCreate(BaseModel):
    """Signup ke liye user se ye data lena hai."""
    email: EmailStr      # EmailStr → format validate karta hai (abc@xyz.com)
    username: str
    password: str        # plain text aata hai, service mein Argon2id se hash hoga


class UserResponse(BaseModel):
    """
    User data jo client ko wapis bhejte hain.
    NOTE: hashed_password yahan nahi hai — kabhi bhi hash client ko nahi bhejna!
    """
    id: UUID
    email: str
    username: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)  # ORM model se directly bana sake
