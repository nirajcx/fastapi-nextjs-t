# Implemented global middleware

RequestContextMiddleware is outermost among custom wrappers; it generates a UUID request ID, adds no-store/security headers, and emits minimal structured logs. It passes non-HTTP scopes through and does not buffer request/response bodies. Do not enable body/token logging while debugging.

Optional configured CORS wraps TrustedHostMiddleware and RateLimitMiddleware. CORS origins are explicit, bearer authorization headers are allowed, and cookie credentials are disabled. Last-added middleware runs first on requests. FastAPI/Starlette also supply internal error layers.

RateLimitMiddleware applies shared PostgreSQL IP and auth-IP fixed-window quotas before parsing/authentication. After authentication, dependencies apply verified-user quotas. The login route adds a normalized-account quota, counting all attempts. Forwarded IP headers are not parsed by the middleware; Uvicorn must only trust a real configured proxy. Local startup in README disables proxy headers.

Atomic PostgreSQL upserts enforce limits across worker processes. Database clock sets window boundaries; denied counters stop at their cap. Keys are hashed (pseudonymous, not anonymized). Rate-limit transactions are independent and commit even when later request work fails. This avoids rolling back an abuse counter with a rejected login.

Authentication read transactions release their connection before quota I/O; otherwise every concurrent request could hold a pool connection while waiting for another one. A single-connection pool test guards against that deadlock pattern.

A denied quota produces 429 with Retry-After. A failed store produces 503. Health/docs/preflight are exempt. Fixed windows allow boundary bursts, and PostgreSQL adds query load; use measured sizing and edge protection. For much higher volume, evaluate Redis or an edge limiter without pretending an in-memory dictionary coordinates multiple workers.

Run `python -m scripts.cleanup` on an explicit schedule to remove bounded batches of old buckets and sessions. No background scheduler has been enabled.
