from typing import List
from uuid import UUID

from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser
from app.db.session import DB
from app.schemas.todos import (
    PresignedUploadRequest,
    PresignedUploadResponse,
    TodoCreate,
    TodoResponse,
    TodoUpdate,
)
from app.services import s3_service
from app.services.todo_service import TodoService

router = APIRouter()


@router.post(
    "/attachment/presign",
    response_model=PresignedUploadResponse,
    status_code=status.HTTP_200_OK,
)
async def presign_upload(body: PresignedUploadRequest, current_user: CurrentUser):
    """
    Step 1 of the file upload flow.

    The frontend calls this BEFORE uploading a file. We generate a temporary
    signed PUT URL that allows the browser to push the file directly to MinIO.

    Why require auth here?
      - Without auth, anyone could spam upload slots and pollute our bucket.
      - The user_id is embedded in the S3 key, so ownership is traceable.

    The frontend then:
      1. PUT body.file to the returned upload_url (with Content-Type header)
      2. Include the returned s3_key in the subsequent POST /todos/create body
    """
    result = s3_service.generate_presigned_upload_url(
        user_id=str(current_user.id),
        file_name=body.file_name,
        content_type=body.content_type,
    )
    return PresignedUploadResponse(**result)


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

