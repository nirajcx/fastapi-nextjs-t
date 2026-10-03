"""Real PostgreSQL coverage: credentials, revocation, races, and public contracts."""

import asyncio
from datetime import timedelta
from uuid import UUID

import pytest
from sqlalchemy import func, select, update

from app.db.base import utc_now
from app.db.models.session import AuthSession
from app.db.models.user import User
from tests.conftest import register_login

pytestmark = pytest.mark.anyio


async def test_register_login_profile_and_logout(api):
    app, client = api
    user, headers = await register_login(client, "Learner@EXAMPLE.COM")
    assert user["email"] == "learner@example.com"
    assert "password" not in str(user) and "token_hash" not in str(user)
    profile = await client.get("/api/v1/users/me", headers=headers)
    assert profile.status_code == 200 and profile.json()["id"] == user["id"]
    assert profile.headers["cache-control"] == "no-store"
    assert profile.headers["x-request-id"]
    assert profile.headers["x-content-type-options"] == "nosniff"
    async with app.state.session_factory() as db:
        saved = await db.scalar(select(User))
        session = await db.scalar(select(AuthSession))
        assert saved.password_hash.startswith("$argon2id$")
        assert session.token_hash not in headers["Authorization"]
    assert (await client.post("/api/v1/auth/logout", headers=headers)).status_code == 200
    assert (await client.get("/api/v1/users/me", headers=headers)).status_code == 401


async def test_duplicate_email_race(api):
    app, client = api
    payload = {
        "email": "same@example.com",
        "display_name": "Learner",
        "password": "correct-horse-password",
    }
    responses = await asyncio.gather(
        *(client.post("/api/v1/auth/register", json=payload) for _ in range(2))
    )
    assert sorted(r.status_code for r in responses) == [201, 409]
    async with app.state.session_factory() as db:
        assert await db.scalar(select(func.count()).select_from(User)) == 1


async def test_invalid_and_unknown_credentials_are_identical(api):
    _, client = api
    await register_login(client)
    responses = []
    for email in ["learner@example.com", "unknown@example.com"]:
        responses.append(
            await client.post(
                "/api/v1/auth/login", json={"email": email, "password": "wrong-password"}
            )
        )
    assert all(r.status_code == 401 for r in responses)
    assert responses[0].json() == responses[1].json()
    assert responses[0].headers["www-authenticate"] == "Bearer"
    for token in [None, "Bearer garbage", "Basic abc", "Bearer " + "a" * 43]:
        headers = {"Authorization": token} if token else {}
        assert (await client.get("/api/v1/users/me", headers=headers)).status_code == 401


async def test_expiry_and_disabled_user(api):
    app, client = api
    user, headers = await register_login(client)
    async with app.state.session_factory.begin() as db:
        await db.execute(update(AuthSession).values(expires_at=utc_now() - timedelta(seconds=1)))
    assert (await client.get("/api/v1/users/me", headers=headers)).status_code == 401
    async with app.state.session_factory.begin() as db:
        await db.execute(update(User).where(User.id == UUID(user["id"])).values(is_active=False))
    response = await client.post(
        "/api/v1/auth/login", json={"email": user["email"], "password": "correct-horse-password"}
    )
    assert response.status_code == 401


async def test_profile_update_and_mass_assignment(api):
    _, client = api
    _, headers = await register_login(client)
    result = await client.patch(
        "/api/v1/users/me", headers=headers, json={"display_name": "  Updated  "}
    )
    assert result.status_code == 200 and result.json()["display_name"] == "Updated"
    for payload in [{"display_name": " "}, {"display_name": "X", "email": "other@example.com"}, {}]:
        assert (
            await client.patch("/api/v1/users/me", headers=headers, json=payload)
        ).status_code == 422


async def test_change_password_revokes_every_session(api):
    _, client = api
    user, first = await register_login(client)
    second_login = await client.post(
        "/api/v1/auth/login", json={"email": user["email"], "password": "correct-horse-password"}
    )
    second = {"Authorization": "Bearer " + second_login.json()["access_token"]}
    bad = await client.post(
        "/api/v1/users/me/password",
        headers=first,
        json={"current_password": "wrong-password", "new_password": "replacement-password"},
    )
    assert bad.status_code == 401
    response = await client.post(
        "/api/v1/users/me/password",
        headers=first,
        json={"current_password": "correct-horse-password", "new_password": "replacement-password"},
    )
    assert response.status_code == 200
    for headers in [first, second]:
        assert (await client.get("/api/v1/users/me", headers=headers)).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/login",
            json={"email": user["email"], "password": "correct-horse-password"},
        )
    ).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/login", json={"email": user["email"], "password": "replacement-password"}
        )
    ).status_code == 200


async def test_session_management_enforces_ownership(api):
    _, client = api
    _, alice = await register_login(client, "alice@example.com")
    _, bob = await register_login(client, "bob@example.com")
    sessions = await client.get("/api/v1/users/me/sessions", headers=alice)
    item = sessions.json()[0]
    assert item["is_current"] and "token_hash" not in item
    route = "/api/v1/users/me/sessions/" + item["id"]
    assert (await client.delete(route, headers=bob)).status_code == 404
    deleted = await client.delete(route, headers=alice)
    assert deleted.status_code == 204 and deleted.content == b""
    assert (await client.get("/api/v1/users/me", headers=alice)).status_code == 401
    assert (await client.post("/api/v1/auth/logout-all", headers=bob)).status_code == 200
    assert (await client.get("/api/v1/users/me", headers=bob)).status_code == 401


async def test_single_logout_preserves_other_session(api):
    _, client = api
    user, first = await register_login(client)
    login = await client.post(
        "/api/v1/auth/login", json={"email": user["email"], "password": "correct-horse-password"}
    )
    second = {"Authorization": "Bearer " + login.json()["access_token"]}
    assert (await client.post("/api/v1/auth/logout", headers=first)).status_code == 200
    assert (await client.get("/api/v1/users/me", headers=second)).status_code == 200


async def test_validation_redacts_raw_input(api):
    _, client = api
    secret = "leak-me"
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": "bad", "display_name": "Name", "password": secret, secret: secret},
    )
    assert response.status_code == 422
    assert secret not in response.text
    assert all("input" not in error and "ctx" not in error for error in response.json()["detail"])


async def test_health_and_swagger(api):
    _, client = api
    for path in ["/docs", "/redoc", "/openapi.json", "/api/v1/health", "/api/v1/health/ready"]:
        assert (await client.get(path)).status_code == 200
    spec = (await client.get("/openapi.json")).json()
    create = spec["paths"]["/api/v1/todos"]["post"]
    assert create["security"] == [{"HTTPBearer": []}]
    assert not any(p["name"] == "X-Tenant-ID" for p in create.get("parameters", []))
    assert "/api/v1/tenants" not in spec["paths"]


async def test_password_change_racing_login_cannot_leave_old_password_session(api):
    _, client = api
    user, headers = await register_login(client)
    changed, login = await asyncio.gather(
        client.post(
            "/api/v1/users/me/password",
            headers=headers,
            json={
                "current_password": "correct-horse-password",
                "new_password": "replacement-password",
            },
        ),
        client.post(
            "/api/v1/auth/login",
            json={"email": user["email"], "password": "correct-horse-password"},
        ),
    )
    assert changed.status_code == 200
    assert login.status_code in {200, 401}
    if login.status_code == 200:
        old = {"Authorization": "Bearer " + login.json()["access_token"]}
        assert (await client.get("/api/v1/users/me", headers=old)).status_code == 401


async def test_login_rehashes_older_password_parameters(api):
    from anyio import to_thread
    from argon2 import PasswordHasher

    app, client = api
    user, _ = await register_login(client)
    old_hash = await to_thread.run_sync(
        PasswordHasher(time_cost=1, memory_cost=8192).hash, "correct-horse-password"
    )
    async with app.state.session_factory.begin() as db:
        await db.execute(
            update(User).where(User.id == UUID(user["id"])).values(password_hash=old_hash)
        )
    assert (
        await client.post(
            "/api/v1/auth/login",
            json={"email": user["email"], "password": "correct-horse-password"},
        )
    ).status_code == 200
    async with app.state.session_factory() as db:
        saved = await db.scalar(select(User.password_hash).where(User.id == UUID(user["id"])))
        assert not app.state.passwords.needs_rehash(saved)
