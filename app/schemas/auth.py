from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.schemas.users import UserResponse


class LoginRequest(BaseModel):
    """Login ke liye user se email + password lena hai."""
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    """
    Successful login ke baad client ko ye bhejte hain.
    Client is session_token ko har request ke header mein bhejega.
    """
    session_token: str
    user: UserResponse
    expires_at: datetime


class LogoutResponse(BaseModel):
    message: str
