from app.api.v1.router import api_router
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import FastAPI
from app.core.config import settings

from app.db.session import get_db
from sqlalchemy import text


app = FastAPI(
    title=settings.app_name,
    description="Learning Todo app",
    version="0.0.1",
)
app.include_router(api_router,prefix="/api/v1")

@app.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "healthy"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
    
