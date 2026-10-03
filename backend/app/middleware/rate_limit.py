import logging
from typing import Optional

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)


class RedisRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Redis-backed Sliding/Fixed Window Rate Limiting Middleware.
    
    Tracks incoming HTTP requests per client IP:
      - Uses Redis INCR command for in-memory, low-latency counting (<1ms).
      - Bypasses PostgreSQL entirely for rate checks.
      - Returns HTTP 429 Too Many Requests when limits are exceeded.
      - Injects standard rate-limiting headers:
          X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After.
    """

    def __init__(
        self,
        app,
        requests_limit: Optional[int] = None,
        window_seconds: Optional[int] = None,
    ):
        super().__init__(app)
        self.requests_limit = requests_limit or settings.rate_limit_requests
        self.window_seconds = window_seconds or settings.rate_limit_window_seconds
        self.exempt_paths = {
            "/docs",
            "/openapi.json",
            "/redoc",
            "/health",
            "/favicon.ico",
        }

    async def dispatch(self, request: Request, call_next) -> Response:
        # 1. Exempt CORS Preflight (OPTIONS) and documentation/health endpoints
        if request.method == "OPTIONS" or request.url.path in self.exempt_paths:
            return await call_next(request)

        # 2. Extract Client IP (handling Reverse Proxy / Cloudflare / Direct connection)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # First IP in comma-separated list is the original client
            client_ip = forwarded_for.split(",")[0].strip()
        elif request.client:
            client_ip = request.client.host
        else:
            client_ip = "unknown_client"

        # 3. Perform atomic increment and TTL verification via Redis pipeline
        try:
            redis = await get_redis()
            if redis is not None:
                key = f"rate_limit:{client_ip}"

                pipe = redis.pipeline()
                pipe.incr(key)
                pipe.ttl(key)
                current_requests, ttl = await pipe.execute()

                # If this is a new window or key has no TTL set
                if current_requests == 1 or ttl == -1:
                    await redis.expire(key, self.window_seconds)
                    ttl = self.window_seconds

                # Compute reset timestamp for the header
                reset_time = ttl if ttl > 0 else self.window_seconds

                # Reject request if rate limit exceeded
                if current_requests > self.requests_limit:
                    logger.warning(
                        f"Rate limit exceeded for IP {client_ip}: "
                        f"{current_requests}/{self.requests_limit} in {self.window_seconds}s"
                    )
                    return JSONResponse(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        content={
                            "detail": f"Too many requests. Limit is {self.requests_limit} requests per {self.window_seconds} seconds."
                        },
                        headers={
                            "Retry-After": str(reset_time),
                            "X-RateLimit-Limit": str(self.requests_limit),
                            "X-RateLimit-Remaining": "0",
                            "X-RateLimit-Reset": str(reset_time),
                        },
                    )

                # Process the request
                response = await call_next(request)

                # Attach rate limit diagnostic headers
                remaining = max(0, self.requests_limit - current_requests)
                response.headers["X-RateLimit-Limit"] = str(self.requests_limit)
                response.headers["X-RateLimit-Remaining"] = str(remaining)
                response.headers["X-RateLimit-Reset"] = str(reset_time)

                return response

        except Exception as e:
            # Fail-open policy: do not block legitimate traffic if Redis encounters an error
            logger.error(f"Redis rate limiter error (failing open): {e}")

        return await call_next(request)
