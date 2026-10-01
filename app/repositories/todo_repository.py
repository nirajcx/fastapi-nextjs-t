from fastapi import HTTPException
from uuid import UUID
from typing import Sequence, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.todo import Todo


class TodoRepository:
    def __init__(self,session:AsyncSession):
        self.session=session

    async def get_todo_by_id(self,todo_id: UUID) -> Optional[Todo]:
        result = await self.session.execute(select(Todo).where(Todo.id == todo_id))
        return result.scalar_one_or_none()

    async def get_all_todos(self) -> Sequence[Todo]:
        result = await self.session.execute(select(Todo))
        return result.scalars().all()

    async def create_todo(self,title:str,description:str) -> Todo:
        todo = Todo(title=title,description=description)
        self.session.add(todo)
        await self.session.commit()
        await self.session.refresh(todo)
        return todo
    
    async def update_todo(self,todo_id: UUID,title:str=None,description:str=None,is_completed:bool=None) -> Todo:
        todo = await self.session.execute(select(Todo).where(Todo.id == todo_id)).scalar_one_or_none()
        if not todo:
            raise HTTPException(status_code=404, detail="Todo not found")
        if title is not None:
            todo.title = title
        if description is not None:
            todo.description = description
        if is_completed is not None:
            todo.is_completed = is_completed
        
        await self.session.commit()
        await self.session.refresh(todo)
        return todo

    async def delete_todo(self,todo_id: UUID) -> bool:
        todo = await self.session.execute(select(Todo).where(Todo.id == todo_id)).scalar_one_or_none()
        if not todo:
            raise HTTPException(status_code=404, detail="Todo not found")
        await self.session.delete(todo)
        await self.session.commit()
        return True

    async def delete_todo(self, todo: Todo) -> None:
        await self.session.delete(todo)
        await self.session.commit()
        