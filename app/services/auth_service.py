from datetime import datetime, timedelta
import json

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis import get_redis
from app.core.security import generate_session_token, hash_password, verify_password
from app.repositories.session_repository import SessionRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, LoginResponse, LogoutResponse
from app.schemas.users import UserCreate, UserResponse


class AuthService:
    """
    Auth business logic:
      - register: naya user banana
      - login: session token generate karna
      - logout: session revoke karna
    """

    def __init__(self, session: AsyncSession):
        # Service do repositories use karta hai — DB se directly baat nahi karta
        self.user_repo = UserRepository(session)
        self.session_repo = SessionRepository(session)

    async def register(self, user_create: UserCreate) -> UserResponse:
        # Step 1: Check karo email already registered toh nahi hai
        if await self.user_repo.exists_by_email(user_create.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        # Step 2: Username bhi unique hona chahiye
        if await self.user_repo.exists_by_username(user_create.username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken",
            )

        # Step 3: Plain password → Argon2id hash (plain password kabhi DB mein nahi jaata)
        hashed = hash_password(user_create.password)

        # Step 4: User create karo
        user = await self.user_repo.create(
            email=user_create.email,
            username=user_create.username,
            hashed_password=hashed,
        )

        return UserResponse.model_validate(user)

    async def login(self, login_req: LoginRequest) -> LoginResponse:
        # Step 1: Email se user dhundho
        user = await self.user_repo.get_by_email(login_req.email)

        # Step 2: User nahi mila OR password wrong → same error (security: enumeration attack se bachao)
        if not user or not verify_password(login_req.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        # Step 3: Account active hai?
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled",
            )

        # Step 4: Secure random token generate karo
        token = generate_session_token()

        # Step 5: Expiry time calculate karo (settings se)
        expires_at = datetime.utcnow() + timedelta(
            hours=settings.session_expire_hours
        )

        # Step 6: DB mein session save karo
        await self.session_repo.create_session(
            user_id=user.id,
            token=token,
            expires_at=expires_at,
        )

        # Step 7: Redis cache mein bhi save karo (Cache Warmup)
        try:
            redis = await get_redis()
            if redis:
                await redis.setex(
                    f"session:{token}",
                    300,  # 5 minutes
                    json.dumps({
                        "id": str(user.id),
                        "email": user.email,
                        "username": user.username,
                        "is_active": user.is_active,
                    }),
                )
        except Exception:
            pass  # Redis optional cache hai

        return LoginResponse(
            session_token=token,
            user=UserResponse.model_validate(user),
            expires_at=expires_at,
        )

    async def logout(self, token: str) -> LogoutResponse:
        # Session ko revoke karo (is_revoked = True)
        await self.session_repo.revoke_session(token)
        return LogoutResponse(message="Logged out successfully")
