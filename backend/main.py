from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.redis import close_redis, init_redis
from app.db.session import get_db
from app.middleware.rate_limit import RedisRateLimitMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_redis()
    print("✅ Redis connected")
    yield
    await close_redis()
    print("Redis connection closed")


app = FastAPI(
    title=f"{settings.app_name} with Keycloak & Redis",
    description="""
## Todo API with Keycloak OIDC & Redis Rate Limiting

### Authentication Options:
1. **Keycloak Bearer JWT (Recommended)**:
   - Click the **Authorize** button above.
   - Enter your Keycloak Bearer token: `Bearer <access_token>`
   - All requests validate against Keycloak (`todo-realm`) and auto-sync user profile into PostgreSQL.

2. **Session Cookie**:
   - Call `POST /api/v1/auth/login` for traditional session cookie authentication.
    """,
    version="0.0.2",
    swagger_ui_parameters={
        "persistAuthorization": True,
        "withCredentials": True,
    },
    lifespan=lifespan,
)

# Redis Rate Limiting Middleware — tracks rate limit per IP/User
app.add_middleware(RedisRateLimitMiddleware)

# CORS — Next.js frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "healthy"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
