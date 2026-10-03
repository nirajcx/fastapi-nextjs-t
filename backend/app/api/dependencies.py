import json
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.keycloak import verify_keycloak_token
from app.core.redis import get_redis
from app.db.models.user import User
from app.db.session import get_db
from app.repositories.session_repository import SessionRepository
from app.repositories.user_repository import UserRepository

# Cookie setup
SESSION_COOKIE_NAME = "session_token"
SESSION_CACHE_TTL = 300  # 5 minutes in seconds

# Bearer scheme (auto_error=False allows falling back to cookie if needed)
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    auth_header: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Authenticate user via Keycloak Bearer JWT or Session Cookie fallback.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated — please login with Keycloak or provide valid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    redis = await get_redis()

    # 1. First priority: Bearer token from Keycloak
    if auth_header and auth_header.credentials:
        token = auth_header.credentials
        cache_key = f"keycloak:token:{token[-32:]}"

        # Fast Redis cache lookup
        cached = await redis.get(cache_key)
        if cached:
            data = json.loads(cached)
            return User(
                id=UUID(data["id"]),
                email=data["email"],
                username=data["username"],
                hashed_password="",
                is_active=data["is_active"],
            )

        # Verify RS256 token against Keycloak JWKS
        payload = verify_keycloak_token(token)
        sub_str = payload.get("sub")
        if not sub_str:
            raise credentials_exception

        try:
            user_uuid = UUID(sub_str)
        except ValueError:
            import uuid
            user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, sub_str)

        username = (
            payload.get("preferred_username")
            or payload.get("username")
            or f"user_{str(user_uuid)[:8]}"
        )
        email = payload.get("email") or f"{username}@keycloak.local"

        user_repo = UserRepository(db)
        user = await user_repo.get_or_create_keycloak_user(
            user_id=user_uuid,
            email=email,
            username=username,
        )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled",
            )

        # Cache in Redis
        await redis.setex(
            cache_key,
            SESSION_CACHE_TTL,
            json.dumps({
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "is_active": user.is_active,
            }),
        )
        return user

    # 2. Fallback: Cookie-based legacy session
    if session_token:
        cache_key = f"session:{session_token}"
        cached = await redis.get(cache_key)
        if cached:
            data = json.loads(cached)
            return User(
                id=UUID(data["id"]),
                email=data["email"],
                username=data["username"],
                hashed_password="",
                is_active=data["is_active"],
            )

        session_repo = SessionRepository(db)
        auth_session = await session_repo.get_by_token(session_token)
        if auth_session is None or auth_session.is_revoked:
            raise credentials_exception

        if datetime.utcnow() > auth_session.expires_at:
            raise credentials_exception

        user_repo = UserRepository(db)
        user = await user_repo.get_by_id(auth_session.user_id)
        if user is None or not user.is_active:
            raise credentials_exception

        await redis.setex(
            cache_key,
            SESSION_CACHE_TTL,
            json.dumps({
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "is_active": user.is_active,
            }),
        )
        return user

    # Neither Bearer token nor cookie provided
    raise credentials_exception


CurrentUser = Annotated[User, Depends(get_current_user)]
