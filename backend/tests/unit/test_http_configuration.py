"""Framework configuration checks without a reachable PostgreSQL server."""

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app


def test_rejects_non_postgres_and_wildcard_production_hosts():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_url="sqlite:///example.db")
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            database_url="postgresql+asyncpg://unused/unused",
            environment="production",
            allowed_hosts=["*"],
        )


@pytest.mark.anyio
async def test_production_docs_disabled_and_trusted_hosts():
    settings = Settings(
        _env_file=None, database_url="postgresql+asyncpg://unused/unused", environment="production"
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            for path in ["/docs", "/redoc", "/openapi.json"]:
                assert (await client.get(path)).status_code == 404
            assert (await client.get("/api/v1/health")).status_code == 200
            assert (
                await client.get("/api/v1/health", headers={"Host": "untrusted.example"})
            ).status_code == 400


@pytest.mark.anyio
async def test_cors_preflight_only_allows_configured_origin():
    settings = Settings(
        _env_file=None,
        database_url="postgresql+asyncpg://unused/unused",
        cors_origins=["https://frontend.example"],
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            headers = {
                "Origin": "https://frontend.example",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Authorization,Content-Type",
            }
            good = await client.options("/api/v1/todos", headers=headers)
            assert good.status_code == 200
            assert good.headers["access-control-allow-origin"] == "https://frontend.example"
            bad = await client.options(
                "/api/v1/todos", headers={**headers, "Origin": "https://attacker.example"}
            )
            assert bad.status_code == 400
            assert "access-control-allow-origin" not in bad.headers
