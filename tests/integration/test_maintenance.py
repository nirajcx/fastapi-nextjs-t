"""Housekeeping removes stale counters/sessions, never active identities."""

from datetime import timedelta
from uuid import UUID

import pytest
from sqlalchemy import func, select

from app.db.base import utc_now
from app.db.models.rate_limit import RateLimitBucket
from app.db.models.session import AuthSession
from app.db.models.user import User
from scripts import cleanup
from tests.conftest import register_login


@pytest.mark.anyio
async def test_cleanup_preserves_active_data(api, monkeypatch):
    app, client = api
    user, headers = await register_login(client)
    async with app.state.session_factory.begin() as db:
        db.add(RateLimitBucket(key_hash="a" * 64, window_start=0, hits=1, expires_at=1))
        db.add(
            AuthSession(
                user_id=UUID(user["id"]),
                token_hash="b" * 64,
                expires_at=utc_now() - timedelta(days=8),
            )
        )
    monkeypatch.setattr(cleanup, "Settings", lambda: app.state.settings)
    await cleanup.cleanup()
    async with app.state.session_factory() as db:
        assert await db.scalar(select(func.count()).select_from(User)) == 1
        assert await db.scalar(select(func.count()).select_from(AuthSession)) == 1
        assert (
            await db.scalar(select(RateLimitBucket).where(RateLimitBucket.key_hash == "a" * 64))
            is None
        )
    assert (await client.get("/api/v1/users/me", headers=headers)).status_code == 200
