from app.db.base import Base
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import DateTime,String,Boolean,func
from uuid import uuid4,UUID


class Todo(Base):
    __tablename__ = "todos"

    id:Mapped[UUID]=mapped_column(UUID,primary_key=True,default=uuid4)
    title:Mapped[str]=mapped_column(String(50),nullable=False)
    description:Mapped[str]=mapped_column(String(100),nullable=True)
    is_completed:Mapped[bool]=mapped_column(Boolean,nullable=False,default=False)
    created_at:Mapped[datetime]=mapped_column(DateTime,nullable=False,default=datetime.now())
    updated_at:Mapped[datetime]=mapped_column(server_default=func.now(),onupdate=datetime.now())    
    
    
    

