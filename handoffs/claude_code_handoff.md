# Claude Code Handoff — E-commerce Order Processing System

## What you are building

A backend system for an e-commerce order processing platform with a React frontend. Customers can place orders with multiple items, track status, and cancel pending orders. Admins can manage all orders and users. A Celery worker auto-advances each order from PENDING to PROCESSING exactly 5 minutes after it was created (not via a polling sweep — via a per-order countdown task).

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Package manager | uv | Replaces pip + virtualenv; use `uv sync` to install |
| API framework | FastAPI | Async, OpenAPI docs built-in |
| ORM | SQLAlchemy 2.x (sync) | Use `Session` + threadpool via FastAPI |
| Database | PostgreSQL 15 | Via `psycopg2-binary` driver |
| Migrations | Alembic | Auto-generate from models |
| Auth | OAuth2 Password flow + JWT | `python-jose`, `passlib[bcrypt]` |
| Task queue | Celery 5 | `apply_async(countdown=300)` per order |
| Broker + backend | Redis 7 | AOF persistence enabled |
| Validation | Pydantic v2 | Request/response schemas |
| Frontend | React + Vite | Served via Nginx |
| Containerisation | Docker + Docker Compose | 6 services |
| Testing | pytest + httpx TestClient | Sync test client (routes are async but TestClient handles it) |

---

## Project structure

```
order-processing/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app factory, router registration, CORS
│   │   ├── database.py           # Sync engine, Session factory, get_db dependency (yields Session)
│   │   ├── models.py             # SQLAlchemy ORM: User, Order, OrderItem
│   │   ├── schemas.py            # Pydantic: UserCreate, Token, OrderCreate, OrderResponse, etc.
│   │   ├── security.py           # hash_password, verify_password, create_access_token, decode_token
│   │   ├── dependencies.py       # get_current_user, require_admin FastAPI dependencies
│   │   ├── tasks.py              # Celery app + auto_process_order task
│   │   └── routers/
│   │       ├── auth.py           # POST /auth/token, POST /auth/register
│   │       ├── orders.py         # CRUD + cancel, role-scoped
│   │       └── users.py          # Admin-only user listing
│   ├── alembic/
│   │   └── versions/             # Migration files
│   ├── tests/
│   │   ├── conftest.py           # Test DB setup, override get_db, fixtures
│   │   └── test_orders.py        # All test cases
│   ├── pyproject.toml        # uv project config + all dependencies
│   ├── uv.lock               # lockfile — commit this
│   └── alembic.ini
│
├── frontend/
│   ├── src/
│   │   ├── context/AuthContext.jsx
│   │   ├── api/orders.js
│   │   └── components/
│   │       ├── LoginForm.jsx
│   │       ├── RegisterForm.jsx
│   │       ├── OrderForm.jsx
│   │       ├── OrderList.jsx
│   │       ├── OrderCard.jsx
│   │       └── AdminOrderList.jsx
│   ├── Dockerfile
│   └── vite.config.js
│
├── docker-compose.yml
└── tests/
```

---

## Docker Compose — 4 services

```yaml
# docker-compose.yml outline
services:

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: orders_db
      POSTGRES_USER: orders_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    # NOT exposed to host — internal only

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes   # AOF persistence — don't remove this
    volumes:
      - redis_data:/data
    # NOT exposed to host — internal only

  api:
    build: ./backend
    command: >
      sh -c "uv run alembic upgrade head &&
             uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    env_file: .env
    ports:
      - "8000:8000"                          # Exposed directly to host
    depends_on: [db, redis]

  worker:
    build: ./backend                         # Same image as api
    command: uv run celery -A app.tasks worker --loglevel=info
    env_file: .env
    depends_on: [db, redis]

volumes:
  postgres_data:
  redis_data:
```

The React frontend runs via `npm run dev` (Vite dev server on port 5173) outside Docker during development. It calls the API at `http://localhost:8000`. CORS must be enabled on the API — see gotcha 11.

---

## Database models

### `UserRole` enum
```python
class UserRole(str, enum.Enum):
    admin    = "admin"
    customer = "customer"
```

### `OrderStatus` enum
```python
class OrderStatus(str, enum.Enum):
    PENDING    = "PENDING"
    PROCESSING = "PROCESSING"
    SHIPPED    = "SHIPPED"
    DELIVERED  = "DELIVERED"
    CANCELLED  = "CANCELLED"
```

### `User`
```python
id              UUID PK
email           String, unique, not null
hashed_password String, not null
role            Enum(UserRole), default=customer
created_at      DateTime
orders          relationship → Order
```

### `Order`
```python
id         UUID PK
user_id    UUID FK → users.id
status     Enum(OrderStatus), default=PENDING
created_at DateTime
updated_at DateTime (onupdate=datetime.utcnow)
items      relationship → OrderItem
owner      relationship → User
```

### `OrderItem`
```python
id           UUID PK
order_id     UUID FK → orders.id
product_name String
quantity     Integer
price        Numeric(10, 2)
```

---

## Auth flow (OAuth2 Password + JWT)

### Endpoints
```
POST /auth/register   Body: { email, password }   → creates customer account
POST /auth/token      Body: form(username, password) → { access_token, token_type }
GET  /users/me        Bearer token → current user info
GET  /users           Admin only → list all users
```

### Token structure (JWT payload)
```json
{ "sub": "<user_uuid>", "role": "customer", "exp": <unix_timestamp> }
```

### `security.py`
```python
SECRET_KEY = os.environ["JWT_SECRET"]        # injected via .env / Docker secret
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def hash_password(plain: str) -> str:        # passlib bcrypt
def verify_password(plain, hashed) -> bool:
def create_access_token(data: dict) -> str:  # adds exp claim
def decode_token(token: str) -> dict:        # raises 401 on invalid/expired
```

### `dependencies.py`
```python
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

# get_db is a sync generator — FastAPI runs it in a threadpool automatically
# because it's a plain `def`, not `async def`
def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# get_current_user is async — it only does CPU work (JWT decode) + one DB lookup
# FastAPI calls get_db in a threadpool, then passes the session here
async def get_current_user(token=Depends(oauth2_scheme), db=Depends(get_db)) -> User:
    payload = decode_token(token)          # raises 401 if invalid/expired
    user = db.get(User, payload["sub"])    # sync call — db is a regular Session
    if not user: raise HTTPException(401)
    return user

async def require_admin(current_user=Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(403, "Admins only")
    return current_user
```

---

## API endpoints

### Auth router — `/auth`
```
POST /auth/register    public
POST /auth/token       public (OAuth2 form body)
```

### Orders router — `/orders`
```
POST   /orders                  authenticated (customer or admin)
GET    /orders                  authenticated — customer sees own, admin sees all
GET    /orders/{id}             authenticated — customer own only, admin any
PATCH  /orders/{id}/status      admin only
DELETE /orders/{id}/cancel      authenticated — customer own + PENDING only
```

### Users router — `/users`
```
GET /users/me    authenticated
GET /users       admin only
```

---

## Role-scoped order queries

```python
# orders.py — GET /orders
# async def endpoint, sync db session — FastAPI handles the threadpool bridging
async def list_orders(current_user=Depends(get_current_user), db=Depends(get_db)):
    q = select(Order)
    if current_user.role != UserRole.admin:
        q = q.where(Order.user_id == current_user.id)
    return db.execute(q).scalars().all()   # no await — db is a sync Session

# DELETE /orders/{id}/cancel
async def cancel_order(id: UUID, current_user=Depends(get_current_user), db=Depends(get_db)):
    order = db.get(Order, id)              # no await
    if not order: raise HTTPException(404)
    if current_user.role == UserRole.customer and order.user_id != current_user.id:
        raise HTTPException(403)
    if order.status != OrderStatus.PENDING:
        raise HTTPException(400, "Only PENDING orders can be cancelled")
    order.status = OrderStatus.CANCELLED
    db.commit()                            # no await
```

---

## Celery task — per-order countdown

This is the key design decision. There is NO periodic Beat sweep. When an order is created, one task is enqueued for that specific order with a 5-minute delay.

### `tasks.py`
```python
from celery import Celery
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

celery_app = Celery(
    "order_tasks",
    broker=os.environ["REDIS_URL"],
    backend=os.environ["REDIS_URL"],
)

# One engine shared by both the API (via get_db) and the Celery worker.
# Both are sync — no dual-engine setup needed.
engine = create_engine(os.environ["DATABASE_URL"])

@celery_app.task(acks_late=True, bind=True, max_retries=3)
def auto_process_order(self, order_id: str):
    # GOTCHA: always use context manager so the session is closed when done.
    # Celery workers are long-lived — unclosed sessions leak DB connections.
    with Session(engine) as db:
        order = db.get(Order, order_id)
        if not order:
            return   # order was deleted, nothing to do
        if order.status != OrderStatus.PENDING:
            return   # already advanced or cancelled — idempotent, skip
        order.status = OrderStatus.PROCESSING
        db.commit()
```

### Enqueueing in the order creation endpoint
```python
# orders.py — POST /orders
async def create_order(...):
    order = Order(user_id=current_user.id, status=OrderStatus.PENDING)
    db.add(order)
    db.flush()     # get order.id before commit — no await, sync session
    for item in body.items:
        db.add(OrderItem(order_id=order.id, **item.dict()))
    db.commit()    # no await

    # Enqueue the countdown task — fires exactly 300s after this moment
    # Must be called AFTER commit so the worker never reads a missing row
    auto_process_order.apply_async(args=[str(order.id)], countdown=300)

    return order
```

---

## Pydantic schemas (key ones)

```python
class OrderItemCreate(BaseModel):
    product_name: str
    quantity: int = Field(gt=0)
    price: Decimal = Field(gt=0, decimal_places=2)

class OrderCreate(BaseModel):
    items: List[OrderItemCreate] = Field(min_length=1)

class OrderResponse(BaseModel):
    id: UUID
    status: OrderStatus
    created_at: datetime
    items: List[OrderItemCreate]
    model_config = ConfigDict(from_attributes=True)

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
```

---

## Tests to write

```python
# conftest.py
# - In-memory SQLite or test Postgres DB spun up per-session
# - Override get_db dependency to use test DB
# - Fixtures: customer_token, admin_token, sample_order

# test_orders.py
def test_create_order()               # POST /orders with valid items
def test_create_order_empty_items()   # should 422
def test_get_order_own()              # customer can fetch own order
def test_get_order_other_customer()   # should 403
def test_get_order_admin()            # admin can fetch any order
def test_list_orders_customer_scoped()# customer only sees own
def test_list_orders_admin_all()      # admin sees all
def test_filter_by_status()           # ?status=PENDING
def test_cancel_pending()             # DELETE → 200
def test_cancel_non_pending()         # DELETE on PROCESSING → 400
def test_cancel_other_customer()      # DELETE on another user's order → 403
def test_auto_process_task()          # call task directly, assert status change
def test_auto_process_skips_cancelled() # task on cancelled order → no-op
def test_register()                   # POST /auth/register
def test_login()                      # POST /auth/token → JWT
def test_invalid_token()              # Bearer garbage → 401
def test_admin_only_route()           # customer hitting admin route → 403
```

---

## Gotchas and decisions log

### 1. Sync DB, async endpoints — how FastAPI bridges them
`get_db` is a plain `def` generator (sync). FastAPI detects this and automatically runs it in a threadpool executor, so it never blocks the event loop. The route functions themselves are `async def` — they can `await` other async things (e.g. sending an email, calling an external API) while the DB work runs in the threadpool. This gives you the best of both worlds without any manual `run_in_executor` calls.

### 2. Session leaks in Celery
Celery workers are long-lived processes. A session opened inside a task and never closed will leak DB connections. Always use `with Session(engine) as db:` — the context manager guarantees `db.close()` even on exceptions.

### 3. `apply_async` after commit, not before
Call `auto_process_order.apply_async(...)` **after** `db.commit()`. If you enqueue before commit, the worker may fire and find no order row yet (race condition on the DB read).

### 4. `acks_late=True` on the task
With `acks_late=True`, the task message is not ack'd until the task completes. If the worker crashes mid-task, the message is re-queued. Pair with idempotent task logic (check `status == PENDING` before updating).

### 5. Redis AOF persistence
By default Redis is in-memory only. If Redis restarts, all pending countdown tasks are lost. The `--appendonly yes` flag enables AOF write-ahead logging. Required for correctness.

### 6. JWT secret via environment variable
Never hardcode `SECRET_KEY`. Inject via `.env` file (Docker Compose `env_file`). Add `.env` to `.gitignore`.

### 7. Password hashing — bcrypt rounds
`passlib` defaults to 12 rounds which is safe. Do not lower it. Do not use `MD5` or `SHA256` directly for passwords.

### 8. CANCELLED is a terminal status
Once an order is CANCELLED, the Celery task (if it fires after cancellation) must be a no-op. The task checks `if order.status != OrderStatus.PENDING: return` before doing anything.

### 9. `db.flush()` vs `db.commit()` in order creation
Use `db.flush()` after adding the Order to get the auto-generated `id` (needed for the OrderItem FK), then add items, then `db.commit()`. One commit total.

### 10. Alembic just works
With sync SQLAlchemy, the default Alembic `env.py` works without modification. No async wiring needed. `alembic upgrade head` runs normally.

### 11. CORS — required, not optional
Without Nginx acting as a same-origin proxy, the React dev server (port 5173) and the API (port 8000) are on different origins. The browser will block every API call unless CORS is configured. Add this to `main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,                   # needed for Bearer token headers
    allow_methods=["*"],
    allow_headers=["*"],
)
```

`allow_credentials=True` is required when the request includes an `Authorization` header. Without it, the browser will block the preflight.

### 13. uv lockfile in Docker
Always use `--frozen` in the Dockerfile `RUN uv sync` call. Without it, uv may silently resolve a slightly different set of versions than what's in `uv.lock`, defeating the purpose of the lockfile. If the lockfile is stale, the build will fail loudly — which is the correct behaviour.

Also copy `pyproject.toml` and `uv.lock` before copying the rest of the source. Docker layer caching means dependency installation only re-runs when those two files change, not on every code edit.

### 14. UUID primary keys
Use `uuid.uuid4` as the Python-side default so the PK is available before the DB round-trip (needed for `apply_async(args=[str(order.id)])` before commit). Do not use `server_default=gen_random_uuid()`.

---

## Environment variables required

```env
DATABASE_URL=postgresql+psycopg2://orders_user:password@db:5432/orders_db
REDIS_URL=redis://redis:6379/0
JWT_SECRET=<long random string, min 32 chars>
JWT_EXPIRE_MINUTES=30
DB_PASSWORD=<postgres password>
```

---

## Alembic migrations

### Setup (run once)
```bash
uv run alembic init alembic        # creates alembic/ dir and alembic.ini
```

In `alembic/env.py`, wire it to your models and database URL:
```python
from app.database import Base, engine
from app import models  # noqa: F401 — import all models so Alembic sees them

target_metadata = Base.metadata

def run_migrations_online():
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
```

In `alembic.ini`, set:
```ini
sqlalchemy.url = postgresql+psycopg2://orders_user:password@db:5432/orders_db
```
Better: leave it blank and override from env in `env.py`:
```python
config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
```

### Workflow
```bash
# Generate a migration from model changes
uv run alembic revision --autogenerate -m "add users table"

# Apply all pending migrations
uv run alembic upgrade head

# Roll back one migration
uv run alembic downgrade -1

# See current state
uv run alembic current

# See full history
uv run alembic history --verbose
```

### Migration order for this project
```
0001_create_users_table
0002_create_orders_table        # depends on users (user_id FK)
0003_create_order_items_table   # depends on orders (order_id FK)
```
Always generate in dependency order. Alembic `--autogenerate` handles this if all models are imported in `env.py` before `target_metadata` is set.

### In Docker
Add a migration step to the `api` service startup, or run it as a separate one-off command before the app starts:
```yaml
# docker-compose.yml — api service
command: >
  sh -c "uv run alembic upgrade head &&
         uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"
```
This ensures migrations always run before the app accepts traffic.

### Gotcha — `--autogenerate` misses some things
Alembic auto-generate detects column additions, removals, and type changes but does **not** detect: changes to server defaults, check constraints, or index changes on some backends. Always review the generated migration file before applying it. Never blindly run autogenerated migrations in production without reading the diff.

---

## Package management — uv

### `pyproject.toml`
```toml
[project]
name = "order-processing"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi",
    "uvicorn[standard]",
    "sqlalchemy",
    "psycopg2-binary",
    "alembic",
    "pydantic[email]",
    "pydantic-settings",
    "python-jose[cryptography]",
    "passlib[bcrypt]",
    "celery[redis]",
    "redis",
    "httpx",
]

[dependency-groups]
dev = [
    "pytest",
    "pytest-asyncio",
    "ruff",
]
```

### Common uv commands
```bash
uv sync                        # install all deps from lockfile
uv sync --group dev            # include dev deps
uv add fastapi                 # add a new dependency
uv run uvicorn app.main:app    # run without activating venv
uv run pytest                  # run tests
uv run alembic upgrade head    # run migrations
```

`uv.lock` is auto-generated and should be committed to version control. Never edit it by hand.

### Dockerfile — uv-based
```dockerfile
FROM python:3.11-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy dependency files first (layer cache — only re-runs if deps change)
COPY pyproject.toml uv.lock ./

# Install dependencies into the system Python (no venv needed inside Docker)
RUN uv sync --frozen --no-dev --no-install-project

# Copy source
COPY . .

# Install the project itself
RUN uv sync --frozen --no-dev
```

`--frozen` ensures the lockfile is used exactly as-is and fails if it's out of date. `--no-dev` skips dev dependencies in the production image.