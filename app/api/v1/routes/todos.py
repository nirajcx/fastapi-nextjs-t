from uuid import UUID
from typing import List
from fastapi import APIRouter,status
from app.db.session import DB
from app.schemas.todos import TodoCreate,TodoUpdate,TodoResponse
from app.services.todo_service import TodoService


router = APIRouter()

@router.get("/", response_model=List[TodoResponse], status_code=status.HTTP_200_OK)
async def get_all_todos(db: DB):
    service = TodoService(db)
    return await service.get_all_todos()

@router.get("/{id}", response_model=TodoResponse, status_code=status.HTTP_200_OK)
async def get_all(db:DB):
    service = TodoService(db)
    return await service.get_todo_by_id(id)
    
@router.post("/create",response_model=TodoResponse,status_code=status.HTTP_201_CREATED)
async def create_todo(db:DB,todo:TodoCreate):
    service = TodoService(db)
    return await service.create_todo(todo)

@router.post("/update/{id}",response_model=TodoResponse,status_code=status.HTTP_200_OK)
async def update_todo(db:DB,todo:TodoUpdate,id:UUID):
    service = TodoService(db)
    return await service.update_todo(id,todo)

@router.post("/delete/{id}",response_model=TodoResponse,status_code=status.HTTP_200_OK)
async def delete_todo(db:DB,id:UUID):
    service = TodoService(db)
    return await service.delete_todo(id)
    
