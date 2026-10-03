from typing import Optional

import redis.asyncio as redis

from app.core.config import settings

# Global Redis client singleton
redis_client: Optional[redis.Redis] = None


async def get_redis() -> Optional[redis.Redis]:
    """Retrieve the shared Redis client instance."""
    return redis_client


async def init_redis() -> None:
    """Initialize Redis client connection during application startup."""
    global redis_client
    redis_client = await redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,  # Return strings directly instead of raw bytes
    )
    await redis_client.ping()


async def close_redis() -> None:
    """Safely terminate Redis client connection during application shutdown."""
    if redis_client:
        await redis_client.aclose()
