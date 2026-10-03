from fastapi import APIRouter, Cookie, Response, status

from app.api.dependencies import SESSION_COOKIE_NAME, CurrentUser
from app.core.config import settings
from app.db.session import DB
from app.schemas.auth import LoginRequest, LoginResponse, LogoutResponse
from app.schemas.users import UserCreate, UserResponse
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_create: UserCreate, db: DB):
    """
    Register a new user account.
    Payload: { email, username, password }
    """
    service = AuthService(db)
    return await service.register(user_create)


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(login_req: LoginRequest, db: DB, response: Response):
    """
    Authenticate user and set session token in HttpOnly cookie.
    Payload: { email, password }
    """
    service = AuthService(db)
    result = await service.login(login_req)

    # Configure secure HttpOnly session cookie
    # HttpOnly=True  -> Prevents JavaScript access (XSS mitigation)
    # Secure=True    -> Only transmitted over HTTPS (in non-local environments)
    # SameSite=lax   -> CSRF mitigation
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=result.session_token,
        httponly=True,
        secure=False,  # Allow cookie over HTTP on local network / homelab IP
        samesite="lax",
        max_age=settings.session_expire_hours * 3600,
    )

    return result


@router.post("/logout", response_model=LogoutResponse, status_code=status.HTTP_200_OK)
async def logout(
    current_user: CurrentUser,
    db: DB,
    response: Response,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    """
    Log out the current session and remove the session cookie.
    """
    from app.repositories.session_repository import SessionRepository
    session_repo = SessionRepository(db)

    # Revoke current device token
    if session_token:
        await session_repo.revoke_session(session_token)

    # Clear cookie from client browser
    response.delete_cookie(key=SESSION_COOKIE_NAME, httponly=True, samesite="lax")

    return LogoutResponse(message="Logged out successfully")


@router.post("/logout-all", response_model=LogoutResponse, status_code=status.HTTP_200_OK)
async def logout_all(current_user: CurrentUser, db: DB, response: Response):
    """
    Revoke all active sessions for the current user across all devices.
    """
    from app.repositories.session_repository import SessionRepository
    session_repo = SessionRepository(db)
    await session_repo.revoke_all_for_user(current_user.id)

    response.delete_cookie(key=SESSION_COOKIE_NAME, httponly=True, samesite="lax")
    return LogoutResponse(message="Logged out from all devices successfully")


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def me(current_user: CurrentUser):
    """
    Fetch the currently authenticated user's profile.
    """
    return UserResponse.model_validate(current_user)
