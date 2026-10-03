# Full-Stack Todo Application with Keycloak OIDC, FastAPI, Redis, and Next.js

A production-grade, secure, multi-tier web application featuring **Keycloak OpenID Connect (OIDC)** authentication, a **FastAPI** resource server, **Redis** sliding-window rate limiting, **PostgreSQL 16** persistence, and a modern **Next.js 16 (App Router)** frontend powered by **shadcn/ui** and **Zustand**.

---

## Architecture Overview

```
                      +------------------------------------------+
                      |         Homelab Ubuntu Host              |
                      |                                          |
                      |  +----------------+  +----------------+  |
                      |  | Keycloak 24    |  | Redis 7        |  |
                      |  | (OIDC / OAuth) |  | (Rate Limiter) |  |
                      |  | Port: 8080     |  | Port: 6379     |  |
                      |  +----------------+  +----------------+  |
                      |          |                               |
                      |  +----------------+                      |
                      |  | PostgreSQL 16  |                      |
                      |  | (lab-db-1:5432)|                      |
                      |  +----------------+                      |
                      +------------------------------------------+
                                     ▲
                                     │
           +─────────────────────────┴─────────────────────────+
           │                                                   │
+-----------------------+                           +-----------------------+
|   Next.js Frontend    | ──(Bearer Token / API)──► |   FastAPI Backend     |
|   (Port 3000)         |                           |   (Port 8000)         |
|   • shadcn/ui         |                           |   • JWT Verification  |
|   • Zustand State     |                           |   • Redis Middleware  |
|   • Configurable Auth |                           |   • SQLAlchemy Async  |
+-----------------------+                           +-----------------------+
```

---

## Key Features

1. **Dual Authentication Support (Configurable in UI)**:
   - **Keycloak OIDC (Recommended)**: Authenticates against Keycloak using RS256 asymmetric cryptographic tokens. FastAPI validates the token against Keycloak's JWKS endpoint (`/protocol/openid-connect/certs`) and automatically synchronizes the user profile in PostgreSQL.
   - **Direct FastAPI API**: Direct registration and login with Argon2id password hashing and Redis-cached session tokens.
2. **Distributed Redis Rate Limiter**:
   - High-performance, in-memory sliding/fixed window rate limiting middleware (`RedisRateLimitMiddleware`).
   - Limits traffic to 60 requests per minute per IP or authenticated user without querying PostgreSQL.
   - Supplies standard HTTP rate-limit response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`.
3. **Strict Multi-Tenant Isolation**:
   - Todos are linked to user accounts via foreign keys.
   - All database queries strictly scope reads, updates, and deletes to the authenticated user ID.
4. **Modern Frontend Experience**:
   - Built with Next.js 16 App Router and TypeScript.
   - Accessible and minimalist component design via **shadcn/ui** and Tailwind CSS.
   - Lightweight, persistent state management with **Zustand**.
   - Real-time Redis rate limit meter and homelab services status monitor.

---

## Directory Structure

```text
crud/
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── api/              # API routes, dependencies & routers
│   │   │   ├── dependencies.py # Keycloak Bearer JWT & Cookie resolvers
│   │   │   └── v1/routes/    # todos.py, auth.py, health.py
│   │   ├── core/             # Core configurations & utilities
│   │   │   ├── config.py     # Pydantic Settings (env loader)
│   │   │   ├── keycloak.py   # PyJWT Keycloak JWKS verification
│   │   │   ├── redis.py      # Async Redis connection pool
│   │   │   └── security.py   # Argon2id password hashing
│   │   ├── db/               # SQLAlchemy asynchronous setup
│   │   │   ├── base.py       # Declarative Base
│   │   │   ├── models/       # User, Todo, AuthSession models
│   │   │   └── session.py    # Async engine & session factory
│   │   ├── repositories/     # Database querying & persistence
│   │   ├── schemas/          # Pydantic request & response schemas
│   │   ├── services/         # Domain business logic
│   │   └── middleware/       # Redis rate limiting & security headers
│   ├── migrations/           # Alembic database schema migrations
│   ├── requirements.txt      # Python dependencies
│   ├── .env                  # Backend environment variables
│   └── main.py               # Backend ASGI entrypoint
│
├── frontend/                 # Next.js 16 Web Application
│   ├── src/
│   │   ├── app/              # Next.js App Router (layout.tsx, page.tsx)
│   │   ├── components/       # shadcn/ui & custom UI components
│   │   │   ├── ui/           # Button, Card, Badge, Input, Tabs
│   │   │   ├── AuthCard.tsx  # Configurable login card (Keycloak / Direct)
│   │   │   └── TodoList.tsx  # Interactive task management & rate meter
│   │   ├── store/            # Zustand global state store
│   │   │   └── useAppStore.ts# Auth and Todo state management
│   │   └── lib/              # API clients & TypeScript definitions
│   │       ├── api.ts        # Typed API bindings
│   │       └── types.ts      # Domain interfaces
│   ├── .env.local            # Frontend environment variables
│   └── package.json          # Node dependencies & build scripts
│
├── .gitignore                # Root gitignore for Python and Node environments
└── main.py                   # Root shim enabling uvicorn to run from root
```

---

## Homelab Setup & Deployment

### 1. Keycloak on Ubuntu Docker

Keycloak runs on your Ubuntu homelab connected to the shared Docker network (`lab_default`):

```yaml
version: '3.8'

services:
  keycloak:
    image: quay.io/keycloak/keycloak:24.0.5
    container_name: lab-keycloak
    restart: unless-stopped
    command: start-dev
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://lab-db-1:5432/keycloak
      KC_DB_USERNAME: postgres
      KC_DB_PASSWORD: your_postgres_password
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: your_admin_password
      KC_HTTP_ENABLED: "true"
      KC_HOSTNAME_STRICT: "false"
    ports:
      - "8080:8080"
    networks:
      - lab_default

networks:
  lab_default:
    external: true
```

#### Keycloak Configuration Steps:
1. Open `http://<HOMELAB_IP>:8080` and log in with your admin credentials.
2. Create Realm: **`todo-realm`**.
3. Create Client: **`todo-app`** (OpenID Connect, Client Authentication: `Off`, Standard Flow: `Checked`, Direct Access Grants: `Checked`).
4. Set Redirect URIs: `http://localhost:8000/*` and `http://localhost:3000/*`.
5. Create a user (e.g., `niraj`) and configure a non-temporary password.

---

### 2. Backend Setup (FastAPI)

1. Activate your virtual environment and install dependencies:
   ```bash
   source venv/bin/activate
   pip install -r backend/requirements.txt
   ```

2. Configure backend environment in `backend/.env`:
   ```ini
   ENVIRONMENT=local
   DATABASE_URL=postgresql+asyncpg://postgres:secret@192.168.1.3:5432/todo_crud_learner
   REDIS_URL=redis://192.168.1.3:6379/0
   SECRET_KEY=your_secret_key_here
   SESSION_EXPIRE_HOURS=168
   KEYCLOAK_SERVER_URL=http://192.168.1.3:8080
   KEYCLOAK_REALM=todo-realm
   KEYCLOAK_CLIENT_ID=todo-app
   ```

3. Run database migrations:
   ```bash
   cd backend
   alembic upgrade head
   cd ..
   ```

4. Start the FastAPI development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   Interactive OpenAPI documentation is available at `http://localhost:8000/docs`.

---

### 3. Frontend Setup (Next.js)

1. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Configure frontend environment in `frontend/.env.local`:
   ```ini
   NEXT_PUBLIC_KEYCLOAK_URL=http://192.168.1.3:8080
   NEXT_PUBLIC_KEYCLOAK_REALM=todo-realm
   NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=todo-app
   NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
   ```

3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your web browser.

---

## API Reference

### Health & Diagnostics
- `GET /health`: Checks database connectivity and system status.

### Authentication Endpoints
- `POST /api/v1/auth/login`: Direct login returning a session token and setting an HttpOnly cookie.
- `POST /api/v1/auth/register`: Creates a new local user with an Argon2id password hash.
- `POST /api/v1/auth/logout`: Revokes the current session and evicts it from the Redis cache.
- `POST /api/v1/auth/logout-all`: Revokes all active sessions for the user across all devices.
- `GET /api/v1/auth/me`: Returns profile details for the authenticated user (supports Keycloak Bearer JWT or Cookie).

### Todos Endpoints (Protected)
- `GET /api/v1/todos/`: List all tasks owned by the authenticated user.
- `POST /api/v1/todos/create`: Create a new task.
- `GET /api/v1/todos/{id}`: Retrieve a specific task by UUID.
- `PATCH /api/v1/todos/update/{id}`: Modify title, description, or completion status.
- `DELETE /api/v1/todos/delete/{id}`: Delete a task.

---

## Rate Limiting Architecture

Requests are monitored through the `RedisRateLimitMiddleware`:
1. The middleware parses the incoming request's client IP or authenticated subject.
2. It executes an atomic pipeline (`INCR` + `TTL`) in Redis.
3. If the request count exceeds 60 within 60 seconds, an `HTTP 429 Too Many Requests` response is immediately returned along with standard `Retry-After` headers.
4. If Redis is temporarily unreachable, the middleware fails open, ensuring uninterrupted service for critical traffic.

---

## Running Automated Tests

Run the test suite using pytest:
```bash
source venv/bin/activate
cd backend
python -m pytest
```
