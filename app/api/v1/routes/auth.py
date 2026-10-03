from fastapi import APIRouter, Response, status

from app.api.dependencies import CurrentUser, SESSION_COOKIE_NAME
from app.db.session import DB
from app.schemas.auth import LoginRequest, LoginResponse, LogoutResponse
from app.schemas.users import UserCreate, UserResponse
from app.services.auth_service import AuthService
from app.core.config import settings

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_create: UserCreate, db: DB):
    """
    Naya user register karo.
    Body: { email, username, password }
    """
    service = AuthService(db)
    return await service.register(user_create)


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(login_req: LoginRequest, db: DB, response: Response):
    """
    Login karo.
    Session token HttpOnly cookie mein set hoga — browser auto-send karta hai.
    Body: { email, password }
    """
    service = AuthService(db)
    result = await service.login(login_req)

    # HttpOnly cookie set karo
    # HttpOnly=True  → JS se token read nahi kar sakta (XSS safe)
    # Secure=True    → sirf HTTPS pe bhejo (production mein True karo)
    # SameSite=lax   → CSRF attacks se protection
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=result.session_token,
        httponly=True,
        secure=settings.environment != "local",   # local mein HTTP OK hai
        samesite="lax",
        max_age=settings.session_expire_hours * 3600,  # seconds mein
    )

    return result


@router.post("/logout", response_model=LogoutResponse, status_code=status.HTTP_200_OK)
async def logout(current_user: CurrentUser, db: DB, response: Response):
    """
    Logout karo — session revoke + cookie delete.
    """
    # current_user ke session token ko dependency se nikala nahi ja sakta directly,
    # isliye service mein user_id se active session revoke karte hain
    from app.repositories.session_repository import SessionRepository
    session_repo = SessionRepository(db)
    await session_repo.revoke_all_for_user(current_user.id)

    # Browser se cookie delete karo
    response.delete_cookie(key=SESSION_COOKIE_NAME, httponly=True, samesite="lax")

    return LogoutResponse(message="Logged out successfully")


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def me(current_user: CurrentUser):
    """
    Apna profile dekho. Cookie automatically send hoti hai browser se.
    """
    return UserResponse.model_validate(current_user)
