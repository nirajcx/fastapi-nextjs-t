"""Only create is implemented; prove owner assignment and keep other CRUD as exercises."""

from uuid import UUID

import pytest
from sqlalchemy import select

from app.db.models.todo import Todo
from tests.conftest import register_login

pytestmark = pytest.mark.anyio


async def test_each_user_creates_their_own_todo(api):
    app, client = api
    niraj, first = await register_login(client, "niraj@example.com")
    rohan, second = await register_login(client, "rohan@example.com")
    created = []
    for user, headers in [(niraj, first), (rohan, second)]:
        response = await client.post(
            "/api/v1/todos", headers=headers, json={"title": "  My task  "}
        )
        assert response.status_code == 201, response.text
        todo = response.json()
        assert todo["owner_id"] == user["id"]
        assert todo["title"] == "My task" and not todo["is_completed"]
        assert "tenant_id" not in todo
        created.append(todo)
    async with app.state.session_factory() as db:
        for user, expected in zip([niraj, rohan], created, strict=True):
            rows = (await db.scalars(select(Todo).where(Todo.owner_id == UUID(user["id"])))).all()
            assert [str(row.id) for row in rows] == [expected["id"]]
    for payload in [
        {"title": "steal", "owner_id": rohan["id"]},
        {"title": "steal", "tenant_id": rohan["id"]},
    ]:
        assert (await client.post("/api/v1/todos", headers=first, json=payload)).status_code == 422
    assert (await client.post("/api/v1/todos", json={"title": "Anonymous"})).status_code == 401


async def test_remaining_crud_stays_unimplemented(api):
    _, client = api
    _, headers = await register_login(client)
    todo = (await client.post("/api/v1/todos", headers=headers, json={"title": "Reference"})).json()
    for method, path, body in [
        ("GET", "/api/v1/todos", None),
        ("GET", "/api/v1/todos/" + todo["id"], None),
        ("PATCH", "/api/v1/todos/" + todo["id"], {"is_completed": True}),
        ("DELETE", "/api/v1/todos/" + todo["id"], None),
    ]:
        assert (await client.request(method, path, headers=headers, json=body)).status_code == 501
