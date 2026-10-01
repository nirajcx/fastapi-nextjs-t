from fastapi import APIRouter
from app.api.v1.routes import todos


api_router = APIRouter()
api_router.include_router(todos.router,prefix="/todos",tags=["todos"])