from app.api.v1.routes import todos
from app.api.v1.routes import todos
from app.api.v1.routes import todos
from app.api.v1.routes import todos
from app.api.v1.routes import todos
from uuid import UUID
from typing import Sequence
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.todo import Todo
from app.schemas.todos import TodoCreate,TodoUpdate,TodoResponse
from app.repositories.todo_repository import TodoRepository


class TodoService:
    def __init__(self,session:AsyncSession):
        self.repo = TodoRepository(session)

    async def get_todo_by_id(self, todo_id: UUID) -> TodoResponse:
        todo = await self.repo.get_todo_by_id(todo_id)
        if not todo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Todo not found"
            )
        return TodoResponse.model_validate(todo)

    async def get_all_todos(self) -> Sequence[TodoResponse]:
        todos = await self.repo.get_all_todos()
        return [TodoResponse.model_validate(todo) for todo in todos]

    async def create_todo(self,todo_create:TodoCreate) -> TodoResponse:
        todo = await self.repo.create_todo(title = todo_create.title.strip(),description = todo_create.description.strip())
        return TodoResponse.model_validate(todo)

    async def delete_todo(self,todo_id:UUID) -> bool:
        if not todo_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Todo id is required"
            )
        todo = await self.repo.get_todo_by_id(todo_id)
        if not todo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Todo not found"
            )
        await self.repo.delete_todo(todo)
        return True
        
    async def update_todo(self,todo_id:UUID,todo_update:TodoUpdate) -> TodoResponse:
        todo = await self.repo.get_todo_by_id(todo_id)
        if not todo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Todo not found"
            )
        updated_todo = todo_update.model_dump(exclude_unset=True)
        for key,value in updated_todo.items():
            setattr(todo,key,value)
        await self.repo.session.commit()
        await self.repo.session.refresh(todo)
        return TodoResponse.model_validate(todo)            