from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import get_db

from app.core.redis import init_redis, close_redis

app = FastAPI(
    title=settings.app_name,
    description="""
## Todo API with Auth

### Swagger mein test kaise karein:
1. **`POST /api/v1/auth/login`** call karo — ye automatically `session_token` cookie set karega
2. Ab baaki protected endpoints directly call karo — cookie browser/Swagger mein saved rahegi
3. Logout ke liye **`POST /api/v1/auth/logout`** call karo
    """,
    version="0.0.1",
    # Swagger UI ko cookies allow karne ke liye
    swagger_ui_parameters={
        "persistAuthorization": True,
        "withCredentials": True,       # Swagger fetch calls mein cookie bhejega
    },
)

# CORS — Frontend ke liye (cookie cross-origin bhejne ke liye credentials=True zaruri hai)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # FE origins
    allow_credentials=True,   # cookies cross-origin allow karna
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.on_event("startup")
async def startup():
    await init_redis()
    print("✅ Redis connected")
    
@app.on_event("shutdown")
async def shutdown():
    await close_redis()
    print("Redis connection closed")


@app.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "healthy"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
