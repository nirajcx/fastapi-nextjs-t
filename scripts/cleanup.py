"""Run manually/scheduled: python -m scripts.cleanup.

Remove expired limiter buckets and long-expired/revoked sessions in bounded
batches. No users or todos are deleted.
"""

import asyncio
from datetime import timedelta

from sqlalchemy import delete, extract, func, or_, select, tuple_

from app.core.config import Settings
from app.db.base import utc_now
from app.db.models.rate_limit import RateLimitBucket
from app.db.models.session import AuthSession
from app.db.session import create_engine, session_factory


async def cleanup() -> None:
    engine = create_engine(Settings())
    try:
        async with session_factory(engine).begin() as db:
            bucket = RateLimitBucket
            # One batch per call bounds lock time; schedule again for large backlogs.
            expired = (
                select(bucket.key_hash, bucket.window_start)
                .where(bucket.expires_at < extract("epoch", func.now()) - 60)
                .limit(5000)
            )
            buckets = await db.execute(
                delete(bucket).where(tuple_(bucket.key_hash, bucket.window_start).in_(expired))
            )
            cutoff = utc_now() - timedelta(days=7)
            sessions = (
                select(AuthSession.id)
                .where(or_(AuthSession.expires_at < cutoff, AuthSession.revoked_at < cutoff))
                .limit(5000)
            )
            removed = await db.execute(delete(AuthSession).where(AuthSession.id.in_(sessions)))
            print(
                f"Removed {buckets.rowcount} expired buckets and {removed.rowcount} old sessions."
            )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(cleanup())
