# Tests

`python -m pytest -q` always runs unit tests. Integration tests skip unless TEST_DATABASE_URL selects an explicit migrated disposable PostgreSQL database whose name ends in `_test`.

**Each integration test truncates app tables in that selected database.** Never point it at valuable data. Tests do not fall back to `.env` DATABASE_URL and do not substitute SQLite for PostgreSQL.

Apply migrations to the disposable DB first, then set TEST_DATABASE_URL and run pytest. See root README for commands. HTTP tests use HTTPX ASGITransport with the real app lifespan and real repositories; they do not bypass authentication dependencies.

Coverage includes registration races, login errors, session expiry/inactive users, public profile protection, exact-session logout/logout-all, session ownership, password changes and concurrent login, automatic Argon2 parameter upgrades, raw input redaction, automatic todo ownership and rejected client ownership, and intentionally unfinished todo routes.

Rate tests use concurrent calls through independent connection pools to the same PostgreSQL store, validate quota boundaries and reset, exercise outages, and check that forged forwarded headers do not bypass IP limits. A one-connection pool test catches nested acquisition deadlocks.

Add your own tests for todo list/read/patch/delete. The current 501 checks are not tests of those unimplemented operations' data isolation.
