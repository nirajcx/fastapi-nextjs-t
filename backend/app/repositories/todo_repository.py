from typing import Optional, Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.todo import Todo


class TodoRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_todo_by_id(self, todo_id: UUID) -> Optional[Todo]:
        result = await self.session.execute(select(Todo).where(Todo.id == todo_id))
        return result.scalar_one_or_none()

    async def get_all_todos(self, user_id: UUID) -> Sequence[Todo]:
        # Filter by user_id to ensure strict tenant isolation
        result = await self.session.execute(

            select(Todo).where(Todo.user_id == user_id)
        )
        return result.scalars().all()

    async def create_todo(
        self,
        user_id: UUID,
        title: str,
        description: Optional[str] = None,
        attachment_key: Optional[str] = None,
        attachment_name: Optional[str] = None,
        attachment_size: Optional[int] = None,
        attachment_content_type: Optional[str] = None,
    ) -> Todo:
        todo = Todo(
            user_id=user_id,
            title=title,
            description=description,
            attachment_key=attachment_key,
            attachment_name=attachment_name,
            attachment_size=attachment_size,
            attachment_content_type=attachment_content_type,
        )
        self.session.add(todo)
        await self.session.commit()
        await self.session.refresh(todo)
        return todo

    async def update_todo(self, todo: Todo) -> Todo:
        await self.session.commit()
        await self.session.refresh(todo)
        return todo

    async def delete_todo(self, todo: Todo) -> None:
        await self.session.delete(todo)
        await self.session.commit()