"""Use real atomic UPSERTs and independent pools, not fake in-memory counters."""

import asyncio

import pytest
from sqlalchemy.exc import OperationalError

from app.db.session import create_engine, session_factory
from app.middleware.rate_limit import PostgresRateLimiter
from tests.conftest import register_login

pytestmark = pytest.mark.anyio


async def test_concurrent_shared_counter(api):
    app, _ = api
    second_engine = create_engine(app.state.settings)
    try:
        second = PostgresRateLimiter(session_factory(second_engine))
        workers = [app.state.limiter, second]
        results = await asyncio.gather(
            *(workers[i % 2].hit("concurrency-test", 5, 3600) for i in range(20))
        )
        assert sum(result.allowed for result in results) == 5
        assert all(1 <= result.retry_after <= 3600 for result in results)
    finally:
        await second_engine.dispose()


async def test_ip_limit_cannot_be_bypassed_by_forwarded_header(api):
    app, client = api
    app.state.settings.rate_limit_requests = 2
    for index in range(2):
        assert (
            await client.get("/api/v1/users/me", headers={"X-Forwarded-For": f"10.0.0.{index}"})
        ).status_code == 401
    result = await client.get("/api/v1/users/me", headers={"X-Forwarded-For": "10.0.0.99"})
    assert result.status_code == 429 and int(result.headers["retry-after"]) >= 1
    assert result.headers["x-request-id"]
    assert (await client.get("/api/v1/health")).status_code == 200


async def test_account_limit_and_stricter_auth_ip_limit(api):
    app, client = api
    app.state.settings.account_rate_limit_requests = 1
    payload = {"email": "unknown@example.com", "password": "incorrect-password"}
    assert (await client.post("/api/v1/auth/login", json=payload)).status_code == 401
    assert (await client.post("/api/v1/auth/login", json=payload)).status_code == 429
    app.state.settings.auth_rate_limit_requests = 2
    assert (
        await client.post("/api/v1/auth/login", json={**payload, "email": "different@example.com"})
    ).status_code == 429


async def test_limiter_fails_closed_without_leaking_exception(api, monkeypatch):
    app, client = api

    async def broken(*args, **kwargs):
        raise OperationalError("secret-query", {}, Exception("secret-password"))

    monkeypatch.setattr(app.state.limiter, "hit", broken)
    result = await client.get("/api/v1/users/me")
    assert result.status_code == 503 and "secret" not in result.text


async def test_auth_checks_work_with_one_pool_connection(api):
    # A one-connection pool exposes nested connection acquisition deadlocks.
    from httpx import ASGITransport, AsyncClient

    from app.main import create_app

    existing, _ = api
    settings = existing.state.settings.model_copy(update={"db_pool_size": 1, "db_max_overflow": 0})
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            _, headers = await register_login(client)
            results = await asyncio.gather(
                *(
                    client.post(
                        "/api/v1/todos",
                        headers=headers,
                        json={"title": str(i)},
                    )
                    for i in range(6)
                )
            )
            assert all(result.status_code == 201 for result in results)


async def test_fixed_window_resets(api):
    app, _ = api
    # Retry beyond the DB-reported boundary, not an assumed worker-local clock.
    first = await app.state.limiter.hit("reset-test", 1, 1)
    assert first.allowed
    denied = await app.state.limiter.hit("reset-test", 1, 1)
    # If the boundary crossed between requests, consume that window first.
    if denied.allowed:
        denied = await app.state.limiter.hit("reset-test", 1, 1)
    assert not denied.allowed
    await asyncio.sleep(denied.retry_after + 0.05)
    assert (await app.state.limiter.hit("reset-test", 1, 1)).allowed


async def test_native_connection_error_also_fails_closed(api, monkeypatch):
    app, client = api

    async def refused(*args, **kwargs):
        raise ConnectionRefusedError("internal-db-address")

    monkeypatch.setattr(app.state.limiter, "hit", refused)
    response = await client.get("/api/v1/users/me")
    assert response.status_code == 503
    assert "internal-db-address" not in response.text
