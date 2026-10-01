from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel,ConfigDict

class TodoBase(BaseModel):
    title: str
    description: Optional[str] = None
    is_completed: bool = False

    model_config = ConfigDict(from_attributes=True)

class TodoCreate(TodoBase):
    pass

class TodoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_completed: Optional[bool] = None


class TodoResponse(TodoBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config=ConfigDict(from_attributes=True)
    