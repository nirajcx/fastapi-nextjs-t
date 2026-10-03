from typing import Sequence
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.todo_repository import TodoRepository
from app.schemas.todos import TodoCreate, TodoResponse, TodoUpdate


class TodoService:
    def __init__(self, session: AsyncSession):
        self.repo = TodoRepository(session)

    async def get_todo_by_id(self, todo_id: UUID, user_id: UUID) -> TodoResponse:
        todo = await self.repo.get_todo_by_id(todo_id)
        if not todo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Todo not found",
            )
        # Authorization check: verify todo ownership
        if todo.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this todo",
            )
        return TodoResponse.model_validate(todo)

    async def get_all_todos(self, user_id: UUID) -> Sequence[TodoResponse]:
        # Retrieve todos belonging strictly to the authenticated user
        todos = await self.repo.get_all_todos(user_id=user_id)
        return [TodoResponse.model_validate(todo) for todo in todos]

    async def create_todo(self, user_id: UUID, todo_create: TodoCreate) -> TodoResponse:
        description = (
            todo_create.description.strip()
            if todo_create.description is not None
            else None
        )
        todo = await self.repo.create_todo(
            user_id=user_id,
            title=todo_create.title.strip(),
            description=description,
        )
        return TodoResponse.model_validate(todo)

    async def delete_todo(self, todo_id: UUID, user_id: UUID) -> None:
        todo = await self.repo.get_todo_by_id(todo_id)
        if not todo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Todo not found",
            )
        # Authorization check: verify todo ownership
        if todo.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this todo",
            )
        await self.repo.delete_todo(todo)

    async def update_todo(
        self, todo_id: UUID, user_id: UUID, todo_update: TodoUpdate
    ) -> TodoResponse:
        todo = await self.repo.get_todo_by_id(todo_id)
        if not todo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Todo not found",
            )
        # Authorization check: verify todo ownership
        if todo.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this todo",
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