from typing import List
from uuid import UUID

from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser
from app.db.session import DB
from app.schemas.todos import TodoCreate, TodoResponse, TodoUpdate
from app.services.todo_service import TodoService

router = APIRouter()


@router.get("/", response_model=List[TodoResponse], status_code=status.HTTP_200_OK)
async def get_all_todos(db: DB, current_user: CurrentUser):
    """Fetch all todos belonging to the authenticated user."""
    service = TodoService(db)
    return await service.get_all_todos(user_id=current_user.id)


@router.get("/{id}", response_model=TodoResponse, status_code=status.HTTP_200_OK)
async def get_todo_by_id(id: UUID, db: DB, current_user: CurrentUser):
    service = TodoService(db)
    return await service.get_todo_by_id(todo_id=id, user_id=current_user.id)


@router.post("/create", response_model=TodoResponse, status_code=status.HTTP_201_CREATED)
async def create_todo(todo: TodoCreate, db: DB, current_user: CurrentUser):
    service = TodoService(db)
    return await service.create_todo(user_id=current_user.id, todo_create=todo)


@router.patch("/update/{id}", response_model=TodoResponse, status_code=status.HTTP_200_OK)
async def update_todo(id: UUID, todo: TodoUpdate, db: DB, current_user: CurrentUser):
    service = TodoService(db)
    return await service.update_todo(todo_id=id, user_id=current_user.id, todo_update=todo)


@router.delete("/delete/{id}", status_code=status.HTTP_200_OK)
async def delete_todo(id: UUID, db: DB, current_user: CurrentUser):
    service = TodoService(db)
    await service.delete_todo(todo_id=id, user_id=current_user.id)
    return {"message": "Todo deleted successfully"}
