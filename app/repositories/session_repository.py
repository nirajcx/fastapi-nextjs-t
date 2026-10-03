from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.session import AuthSession


class SessionRepository:
    """
    AuthSession table se baat karta hai.
    Session create, fetch, revoke, aur cleanup karta hai.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_session(
        self, user_id: UUID, token: str, expires_at: datetime
    ) -> AuthSession:
        auth_session = AuthSession(
            user_id=user_id,
            session_token=token,
            expires_at=expires_at,
        )
        self.session.add(auth_session)
        await self.session.commit()
        await self.session.refresh(auth_session)
        return auth_session

    async def get_by_token(self, token: str) -> Optional[AuthSession]:
        result = await self.session.execute(
            select(AuthSession).where(AuthSession.session_token == token)
        )
        return result.scalar_one_or_none()

    async def revoke_session(self, token: str) -> None:
        """Session ko is_revoked=True mark karo (soft delete)."""
        session = await self.get_by_token(token)
        if session:
            session.is_revoked = True
            await self.session.commit()

    async def revoke_all_for_user(self, user_id: UUID) -> None:
        """User ke saare active sessions revoke karo — logout pe use hota hai."""
        from sqlalchemy import update
        from app.db.models.session import AuthSession
        await self.session.execute(
            update(AuthSession)
            .where(AuthSession.user_id == user_id, AuthSession.is_revoked.is_(False))
            .values(is_revoked=True)
        )
        await self.session.commit()

    async def delete_expired(self) -> None:
        """Expired sessions ko DB se clean karo — cron job mein call kar sakte ho."""
        now = datetime.now(timezone.utc)
        await self.session.execute(
            delete(AuthSession).where(AuthSession.expires_at < now)
        )
        await self.session.commit()
