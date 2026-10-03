from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User
from app.db.session import get_db
from app.repositories.session_repository import SessionRepository
from app.repositories.user_repository import UserRepository

import json
from app.core.redis import get_redis

# Cookie ka naam — ek jagah define karo taaki everywhere same rahe
SESSION_COOKIE_NAME = "session_token"
SESSION_CACHE_TTL = 300  # 5 minutes (seconds mein)


async def get_current_user(
    # Browser automatically ye cookie bhejta hai har request mein
    # Swagger mein manually set karna padega (neeche explain hai)
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Cookie se session token padho → validate karo → User return karo.
    Agar cookie nahi hai ya invalid hai → 401.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated — please login first",
    )

    # Cookie nahi aayi?
    if not session_token:
        raise credentials_exception

    redis = await get_redis()
    cache_key = f"session:{session_token}"

    cached = await redis.get(cache_key)

    if cached:
        data = json.loads(cached)
        return User(
            id=UUID(data["id"]),
            email=data["email"],
            username=data["username"],
            hashed_password="",   # security: cache mein hash nahi rakhte
            is_active=data["is_active"],
        )

    # DB mein session dhundho
    session_repo = SessionRepository(db)
    auth_session = await session_repo.get_by_token(session_token)

    if auth_session is None:
        raise credentials_exception

    # Revoked hai? (logout ke baad)
    if auth_session.is_revoked:
        raise credentials_exception

    # Expired hai?
    now = datetime.utcnow()
    if now > auth_session.expires_at:
        raise credentials_exception

    # User fetch karo
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(auth_session.user_id)

    if user is None or not user.is_active:
        raise credentials_exception

     # ── 3. Redis mein save karo (5 min ke liye) ────────────
    await redis.setex(
        cache_key,
        SESSION_CACHE_TTL,
        json.dumps({
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "is_active": user.is_active,
        })
    )

    return user


# Shorthand alias — routes mein sirf CurrentUser likhna
CurrentUser = Annotated[User, Depends(get_current_user)]
