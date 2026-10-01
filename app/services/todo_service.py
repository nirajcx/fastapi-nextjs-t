from typing import Sequence
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.todo import Todo
from app.repositories.todo_repository import TodoRepository
from app.schemas.todos import TodoCreate, TodoResponse, TodoUpdate


class TodoService:
    def __init__(self, session: AsyncSession):
        self.repo = TodoRepository(session)

    async def get_todo_by_id(self, todo_id: UUID) -> TodoResponse:
        todo = await self.repo.get_todo_by_id(todo_id)
        if not todo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Todo not found",
            )
        return TodoResponse.model_validate(todo)

    async def get_all_todos(self) -> Sequence[TodoResponse]:
        todos = await self.repo.get_all_todos()
        return [TodoResponse.model_validate(todo) for todo in todos]

    async def create_todo(self, todo_create: TodoCreate) -> TodoResponse:
        description = (
            todo_create.description.strip()
            if todo_create.description is not None
            else None
        )
        todo = await self.repo.create_todo(
            title=todo_create.title.strip(),
            description=description,
        )
        return TodoResponse.model_validate(todo)

    async def delete_todo(self, todo_id: UUID) -> None:
        todo = await self.repo.get_todo_by_id(todo_id)
        if not todo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Todo not found",
            )
        await self.repo.delete_todo(todo)

    async def update_todo(self, todo_id: UUID, todo_update: TodoUpdate) -> TodoResponse:
        todo = await self.repo.get_todo_by_id(todo_id)
        if not todo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Todo not found",
            )
        updated_data = todo_update.model_dump(exclude_unset=True)
        for key, value in updated_data.items():
            if key == "title" and isinstance(value, str):
                value = value.strip()
            elif key == "description" and isinstance(value, str):
                value = value.strip()
            setattr(todo, key, value)

        updated_todo = await self.repo.update_todo(todo)
        return TodoResponse.model_validate(updated_todo)