# app/core/redis.py  ← naya file banao

import redis.asyncio as redis
from app.core.config import settings

# Global client — ek baar banta hai, sab jagah use hota hai
redis_client: redis.Redis = None

async def get_redis() -> redis.Redis:
    return redis_client

async def init_redis():
    """App startup pe call hoga"""
    global redis_client
    redis_client = await redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,   # bytes nahi, string milega directly
    )
    await redis_client.ping()

async def close_redis():
    """App shutdown pe call hoga"""
    if redis_client:
        await redis_client.aclose()
