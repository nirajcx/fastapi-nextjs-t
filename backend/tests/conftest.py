"""Integration tests require an explicitly selected disposable *_test database."""

import os

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.core.config import Settings
from app.main import create_app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def api():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to a migrated disposable *_test PostgreSQL database")
    if not (make_url(url).database or "").endswith("_test"):
        pytest.fail("Refusing to truncate a database whose name does not end with _test")
    settings = Settings(
        _env_file=None,
        database_url=url,
        environment="test",
        rate_limit_requests=10000,
        auth_rate_limit_requests=10000,
        account_rate_limit_requests=10000,
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        async with app.state.engine.begin() as db:
            # This explicit database opt-in is why tests never touch .env's DB.
            await db.execute(
                text("TRUNCATE todos, auth_sessions, users, rate_limit_buckets CASCADE")
            )
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            yield app, client


async def register_login(client, email="learner@example.com", password="correct-horse-password"):
    registered = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "display_name": "Learner", "password": password},
    )
    assert registered.status_code == 201, registered.text
    logged_in = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert logged_in.status_code == 200, logged_in.text
    return registered.json(), {"Authorization": "Bearer " + logged_in.json()["access_token"]}
