# FastAPI Todo App — Build Karo Khud Se

Yeh ek **learning project** hai. Saari files empty hain — tumhe khud ek ek cheez likhni hai.
Yeh README tumhara **guide** hai — kya likhna hai, kahan likhna hai, aur kyu.

---

## Project Ka Goal

Ek simple Todo API banana jisme:
- User register kar sake
- Login kare, token mile
- Apne todos create/read/update/delete kar sake
- Dusre user ke todos kabhi na dikhe

---

## Folder Structure

```
crud/
├── main.py                         ← Entry point: uvicorn yahan se app uthata hai
├── requirements.txt                ← Sari dependencies yahan likhni hain
├── .env                            ← Secret config (DB URL, etc.) — git mein mat daalo
├── alembic.ini                     ← Alembic config (DB migrations)
├── migrations/                     ← Alembic migration files yahan banti hain
│   └── versions/                   ← Har migration ek file = ek DB change
│
└── app/                            ← Poora application yahan hai
    ├── main.py                     ← FastAPI app factory (create_app function)
    │
    ├── core/                       ← App-wide shared utilities
    │   ├── config.py               ← Settings (env variables read karo yahan)
    │   ├── exceptions.py           ← Custom errors + FastAPI exception handlers
    │   ├── lifespan.py             ← App startup/shutdown (DB pool, hasher init)
    │   ├── logging.py              ← Logger setup
    │   └── security.py            ← Password hashing, token generation
    │
    ├── db/                         ← Database layer
    │   ├── base.py                 ← SQLAlchemy Base class (sab models yahan se inherit karte hain)
    │   ├── session.py              ← Engine + Connection Pool + get_db() function
    │   └── models/                 ← Database tables (SQLAlchemy ORM models)
    │       ├── user.py             ← users table
    │       ├── todo.py             ← todos table
    │       ├── session.py          ← auth_sessions table (login tokens)
    │       └── rate_limit.py       ← rate_limit_buckets table
    │
    ├── schemas/                    ← Pydantic schemas (request/response shapes)
    │   ├── common.py               ← Shared schemas (ErrorResponse, MessageResponse)
    │   ├── auth.py                 ← LoginRequest, RegisterRequest, TokenResponse
    │   ├── users.py                ← UserRead (password kabhi expose mat karo)
    │   └── todos.py                ← TodoCreate, TodoUpdate, TodoRead, TodoPage
    │
    ├── repositories/               ← Sirf DB queries yahan (koi business logic nahi)
    │   ├── user_repository.py      ← User DB operations
    │   ├── session_repository.py   ← Auth session DB operations
    │   └── todo_repository.py      ← Todo DB operations
    │
    ├── services/                   ← Business logic yahan (koi SQL nahi)
    │   ├── auth_service.py         ← Register, login, logout logic
    │   ├── user_service.py         ← User profile, password change logic
    │   └── todo_service.py         ← Todo create/read/update/delete logic
    │
    ├── api/                        ← HTTP layer
    │   ├── dependencies.py         ← FastAPI Depends: get_db, get_current_user
    │   └── v1/
    │       ├── router.py           ← Sare routes ek jagah include karo
    │       └── routes/
    │           ├── health.py       ← GET /health (server alive check)
    │           ├── auth.py         ← POST /auth/register, /login, /logout
    │           ├── users.py        ← GET/PATCH /users/me
    │           └── todos.py        ← CRUD /todos
    │
    └── middleware/                 ← Har request se pehle/baad chalne wala code
        ├── request_context.py      ← Request ID, logging, security headers
        └── rate_limit.py           ← IP aur user rate limiting
```

---

## Request Lifecycle — Ek Request Aane Par Kya Hota Hai

```
CLIENT → POST /api/v1/todos  (Bearer token + JSON body)
  │
  ▼
[1] RequestContextMiddleware    (middleware/request_context.py)
    → Unique Request ID banao
    → Timer shuru karo
    → Security headers add karo (X-Frame-Options, etc.)
  │
  ▼
[2] TrustedHostMiddleware       (built-in FastAPI/Starlette)
    → Kya Host header allowed hai? (.env mein ALLOWED_HOSTS)
  │
  ▼
[3] RateLimitMiddleware         (middleware/rate_limit.py)
    → IP se request count check karo DB mein
    → Limit exceed? → 429 Too Many Requests
  │
  ▼
[4] Router                      (api/v1/router.py)
    → URL + Method match karo
    → create_todo() function milaa
  │
  ▼
[5] Dependencies resolve        (api/dependencies.py)
    │
    ├── get_db()
    │   → Connection Pool se ek connection uthao
    │   → AsyncSession banao (yeh pura request tak rahegi)
    │
    └── get_current_user(db)
        → Authorization header se token nikalo
        → SHA256(token) → DB mein dhundo (auth_sessions table)
        → Expired ya revoked? → 401 Unauthorized
        → User object banao
        → Rate limit: is user ke liye bhi check karo
  │
  ▼
[6] Route Function              (api/v1/routes/todos.py)
    → Sirf call forward karo service ko
    → Koi business logic nahi yahan
  │
  ▼
[7] Service                     (services/todo_service.py)
    → Business rules yahan
    → owner_id = current_user.id  (server side set, client nahi de sakta)
    → Repository call karo
    → db.commit() karo (permanent save)
  │
  ▼
[8] Repository                  (repositories/todo_repository.py)
    → Sirf SQL/ORM query yahan
    → db.add(todo) → db.flush()
    → Todo object return karo
  │
  ▼
[9] Response
    → TodoRead schema mein convert karo
    → 201 Created JSON response
  │
  ▼
[10] get_db() cleanup           (session.py - yield ke baad)
     → Session close
     → Connection WAPAS Pool mein
  │
  ▼
[11] RequestContextMiddleware finally
     → Log: {method, route, status, duration_ms}

RESPONSE CLIENT KO GAYA ✅
```

---

## Step-by-Step Build Order

### Step 1 — requirements.txt likho

```
fastapi
uvicorn[standard]
sqlalchemy[asyncio]
asyncpg
alembic
pydantic-settings
argon2-cffi
python-dotenv
```

```bash
pip install -r requirements.txt
```

---

### Step 2 — .env banao

```
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/todo_db
ENVIRONMENT=local
SESSION_TTL_SECONDS=86400
ALLOWED_HOSTS=["localhost","127.0.0.1"]
```

> ⚠️ `.env` ko `.gitignore` mein daalo! Kabhi commit mat karo.

---

### Step 3 — `app/core/config.py` likho

Yahan `pydantic-settings` se `Settings` class banao jo `.env` file padhe.

```python
# Kya likhna hai:
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")
    
    app_name: str = "Todo API"
    environment: str = "local"
    database_url: str          # .env se aayega
    session_ttl_seconds: int = 86400
    # ... baaki settings
```

---

### Step 4 — `app/db/base.py` likho

SQLAlchemy ka `Base` class yahan banao. Sab models isko inherit karenge.

```python
# Kya likhna hai:
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass  # Bas itna! (naming_convention add karna optional)
```

---

### Step 5 — `app/db/models/` ke files likho

**Pehle `user.py`:**
```python
# users table
# Columns: id (UUID PK), email (unique), display_name, password_hash, is_active, created_at
```

**Phir `session.py` (auth_sessions table):**
```python
# Columns: id (UUID PK), user_id (FK → users), token_hash (unique), created_at, expires_at, revoked_at
```

**Phir `todo.py`:**
```python
# Columns: id (UUID PK), owner_id (FK → users), title, description, is_completed, created_at, updated_at
```

**Important:** Har model `Base` se inherit kare aur `__tablename__` define kare.

---

### Step 6 — `app/db/session.py` likho

Connection Pool aur `get_db()` yahan banao.

```python
# Kya likhna hai:
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

def create_engine(settings):
    return create_async_engine(
        settings.database_url,
        pool_size=5,          # 5 connections ready rakhna
        max_overflow=5,       # busy pe 5 extra
        pool_timeout=5,       # 5 sec wait, phir error
    )

def session_factory(engine):
    return async_sessionmaker(engine, expire_on_commit=False)

async def get_db(request):
    async with request.app.state.session_factory() as session:
        yield session   # ← request ko session do, khatam hone pe close
```

---

### Step 7 — `app/core/lifespan.py` likho

App start aur band hone pe kya karna hai.

```python
# Kya likhna hai:
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    # STARTUP
    engine = create_engine(app.state.settings)
    app.state.engine = engine
    app.state.session_factory = session_factory(engine)
    # password hasher bhi yahan init karo
    
    yield  # ← "App ready hai"
    
    # SHUTDOWN
    await engine.dispose()  # Pool close karo
```

---

### Step 8 — `app/core/security.py` likho

Password hashing aur token generation yahan.

```python
# Kya likhna hai:
from argon2 import PasswordHasher
import secrets, hashlib

def generate_token() -> str:
    return secrets.token_urlsafe(32)  # 43 char random token

def token_digest(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()

# PasswordHasher class (Argon2id):
ph = PasswordHasher()
ph.hash("mypassword")       # → "$argon2id$..."
ph.verify(stored_hash, "mypassword")  # → True/False
```

---

### Step 9 — `app/schemas/` ke files likho

Pydantic models — request aur response ke shapes.

```python
# todos.py mein kya chahiye:

class TodoCreate(BaseModel):   # ← User bhejta hai
    title: str
    description: str | None = None

class TodoUpdate(BaseModel):   # ← Partial update
    title: str | None = None
    is_completed: bool | None = None

class TodoRead(BaseModel):     # ← Server return karta hai
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    owner_id: UUID             # ← Owner kaun hai
    title: str
    is_completed: bool
    created_at: datetime
```

> ⚠️ `TodoRead` mein `owner_id` hai lekin password nahi — `UserRead` mein `password_hash` kabhi mat daalo!

---

### Step 10 — `app/repositories/` ke files likho

Sirf DB queries. Koi business logic nahi. `owner_id` hamesha parameter mein lo.

```python
# todo_repository.py mein likhna hai:

async def insert(db, *, owner_id, title, description) -> Todo:
    # Todo object banao, db.add(), db.flush(), return

async def list_with_count(db, *, owner_id, limit, offset) -> tuple[list[Todo], int]:
    # SELECT * FROM todos WHERE owner_id = ? ORDER BY created_at LIMIT ? OFFSET ?
    # Count bhi nikalo same filter se

async def get_scoped(db, *, id, owner_id) -> Todo | None:
    # SELECT * FROM todos WHERE id = ? AND owner_id = ?
    # DONO condition zaruri — sirf id se mat dhundo!

async def update_scoped(db, *, id, owner_id, patch: dict) -> Todo | None:
    # Pehle get_scoped se dhundo
    # Phir fields update karo
    # db.flush()

async def delete_scoped(db, *, id, owner_id) -> bool:
    # Pehle get_scoped se dhundo
    # db.delete(todo)
    # db.flush()
    # Return True/False
```

---

### Step 11 — `app/services/` ke files likho

Business logic. Repository call karo. `db.commit()` yahan karo.

```python
# todo_service.py mein likhna hai:

async def create(db, *, user_id, payload) -> TodoRead:
    todo = await todo_repository.insert(db, owner_id=user_id, ...)
    await db.commit()
    return TodoRead.model_validate(todo)

async def list_todos(db, *, user_id, limit, offset) -> TodoPage:
    todos, total = await todo_repository.list_with_count(db, owner_id=user_id, ...)
    return TodoPage(items=[TodoRead.model_validate(t) for t in todos], total=total, ...)

async def read_todo(db, *, user_id, todo_id) -> TodoRead:
    todo = await todo_repository.get_scoped(db, id=todo_id, owner_id=user_id)
    if todo is None:
        raise DomainError(404, "Todo not found.")
    return TodoRead.model_validate(todo)

async def update_todo(db, *, user_id, todo_id, payload) -> TodoRead:
    patch = payload.model_dump(exclude_unset=True)  # sirf jo fields aaye hain
    todo = await todo_repository.update_scoped(db, id=todo_id, owner_id=user_id, patch=patch)
    if todo is None:
        raise DomainError(404, "Todo not found.")
    await db.commit()
    return TodoRead.model_validate(todo)

async def delete_todo(db, *, user_id, todo_id) -> None:
    deleted = await todo_repository.delete_scoped(db, id=todo_id, owner_id=user_id)
    if not deleted:
        raise DomainError(404, "Todo not found.")
    await db.commit()
```

---

### Step 12 — `app/api/dependencies.py` likho

FastAPI `Depends` — session aur auth yahan resolve hota hai.

```python
# Kya likhna hai:

Db = Annotated[AsyncSession, Depends(get_db)]

async def get_current_user(db: Db, credentials: ...) -> UserRead:
    # 1. Bearer token nikalo
    # 2. SHA256 hash banao
    # 3. DB mein dhundo (session_repository)
    # 4. Expired? Revoked? → 401
    # 5. User return karo

CurrentUser = Annotated[UserRead, Depends(get_current_user)]
```

---

### Step 13 — `app/api/v1/routes/todos.py` likho

HTTP thin layer — sirf request lo, service call karo, response do.

```python
router = APIRouter(prefix="/todos", tags=["Todos"])

@router.post("", response_model=TodoRead, status_code=201)
async def create_todo(payload: TodoCreate, current_user: CurrentUser, db: Db):
    return await todo_service.create(db, user_id=current_user.id, payload=payload)

@router.get("", response_model=TodoPage)
async def list_todos(current_user: CurrentUser, db: Db, limit: int = 20, offset: int = 0):
    return await todo_service.list_todos(db, user_id=current_user.id, limit=limit, offset=offset)

@router.get("/{todo_id}", response_model=TodoRead)
async def read_todo(todo_id: UUID, current_user: CurrentUser, db: Db):
    return await todo_service.read_todo(db, user_id=current_user.id, todo_id=todo_id)

@router.patch("/{todo_id}", response_model=TodoRead)
async def update_todo(todo_id: UUID, payload: TodoUpdate, current_user: CurrentUser, db: Db):
    return await todo_service.update_todo(db, user_id=current_user.id, todo_id=todo_id, payload=payload)

@router.delete("/{todo_id}", status_code=204)
async def delete_todo(todo_id: UUID, current_user: CurrentUser, db: Db):
    await todo_service.delete_todo(db, user_id=current_user.id, todo_id=todo_id)
```

---

### Step 14 — `app/main.py` likho

FastAPI app factory.

```python
def create_app(settings=None) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.state.settings = settings
    
    # Exception handlers register karo
    register_handlers(app)
    
    # Routes include karo
    app.include_router(api_router, prefix="/api/v1")
    
    # Middleware add karo (reverse order mein — last added = first run)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(RequestContextMiddleware)
    
    return app

app = create_app()
```

---

### Step 15 — `main.py` (root) likho

```python
from app.main import app  # bas itna
```

---

### Step 16 — Alembic setup karo

```bash
# Alembic initialize karo (agar pehli baar)
alembic init migrations

# migrations/env.py mein apne models import karo
# aur database_url set karo

# Pehli migration banao
alembic revision --autogenerate -m "initial tables"

# Migration apply karo
alembic upgrade head
```

---

### Step 17 — Server chalao

```bash
uvicorn main:app --reload
```

Phir browser mein jao: `http://localhost:8000/docs`

---

## Important Rules (Kabhi Mat Todna)

| Rule | Kyu |
|---|---|
| `owner_id` hamesha server se set karo | Client khud owner nahi ban sakta |
| Repository mein sirf SQL | Service mein SQL = testability khatam |
| Service mein `db.commit()` karo | Route ya repo commit kare = incomplete transactions |
| `password_hash` kabhi response mein mat daalo | Security breach |
| Token sirf hash karke store karo | DB hack hone pe bhi tokens useless |
| `get_scoped()` mein `id AND owner_id` dono filter | Sirf id = dusre ka todo le sakte hain |

---

## Concepts Jo Samajhne Hain

| Concept | Kahan Hai | Kyu |
|---|---|---|
| Connection Pool | `db/session.py` | Har request pe naya connection = slow |
| Argon2id | `core/security.py` | bcrypt se better, GPU-resistant |
| Opaque Token | `core/security.py` | Revoke kar sakte hain (JWT nahi kar sakte) |
| SHA256 hash of token | `repositories/session_repository.py` | DB hack pe bhi tokens useless |
| `Mapped[X]` | Models mein | SQLAlchemy 2.x — type-safe columns |
| `Depends()` | `api/dependencies.py` | Automatic inject + cleanup |
| `yield` in get_db | `db/session.py` | Session auto-close after request |
| `flush()` vs `commit()` | Repository/Service | flush = temporary, commit = permanent |
| Alembic migrations | `migrations/` | DB schema version control |

---

## Development Flow

```
Nayi feature banana ho:

1. Model banao (db/models/)        ← DB table kesi hogi
2. Migration banao (alembic)       ← DB mein actually banao
3. Schema banao (schemas/)         ← Request/Response shape
4. Repository banao (repositories/)← DB queries
5. Service banao (services/)       ← Business logic
6. Route banao (routes/)           ← HTTP endpoint
7. Router mein include karo        ← URL se connect karo
```

---

## Shubhkamnayein! 🚀

Sab kuch tumhe khud likhna hai — copy-paste mat karna.
Ek ek file kholo, upar README padho, aur implement karo.
Koi error aaye to samajhne ki koshish karo — wahi asli learning hai.
