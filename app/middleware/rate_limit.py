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
    
    Har incoming HTTP request ke Client IP ko track karta hai:
      - Redis INCR command se request count badhata hai (in-memory, <1ms).
      - Database (PostgreSQL) ko bilkul hit nahi karta.
      - Limit exceed hone par HTTP 429 Too Many Requests return karta hai.
      - Standard RateLimit headers inject karta hai:
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
        # 1. CORS Preflight (OPTIONS) aur Docs/Health endpoints ko exempt karo
        if request.method == "OPTIONS" or request.url.path in self.exempt_paths:
            return await call_next(request)

        # 2. Client IP extract karo (Reverse proxy / Cloudflare / Direct)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # First IP in comma-separated list is the original client
            client_ip = forwarded_for.split(",")[0].strip()
        elif request.client:
            client_ip = request.client.host
        else:
            client_ip = "unknown_client"

        # 3. Redis se atomic increment + TTL check karo
        try:
            redis = await get_redis()
            if redis is not None:
                key = f"rate_limit:{client_ip}"

                pipe = redis.pipeline()
                pipe.incr(key)
                pipe.ttl(key)
                current_requests, ttl = await pipe.execute()

                # Agar naya window start hua hai ya expiry miss ho gayi
                if current_requests == 1 or ttl == -1:
                    await redis.expire(key, self.window_seconds)
                    ttl = self.window_seconds

                # Expiry calculate karo reset header ke liye
                reset_time = ttl if ttl > 0 else self.window_seconds

                # Agar limit exceed ho gayi
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

                # Request ko aage process hone do
                response = await call_next(request)

                # Headers add karo client ke information ke liye
                remaining = max(0, self.requests_limit - current_requests)
                response.headers["X-RateLimit-Limit"] = str(self.requests_limit)
                response.headers["X-RateLimit-Remaining"] = str(remaining)
                response.headers["X-RateLimit-Reset"] = str(reset_time)

                return response

        except Exception as e:
            # Fail-open: Agar Redis down ho ya error aaye to user request block mat karo
            logger.error(f"Redis rate limiter error (failing open): {e}")

        return await call_next(request)
