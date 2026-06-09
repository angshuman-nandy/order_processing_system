# CLAUDE.md — Order Processing System

This file tells Claude Code how to work in this project. Read it fully before doing anything.

---

## What this project is

An e-commerce order processing backend with a React frontend. Customers place orders, track status, and cancel pending orders. Admins manage all orders and users. A Celery worker automatically advances each order from PENDING → PROCESSING exactly 5 minutes after creation using `apply_async(countdown=300)`.

---

## Tech stack

| Layer | Choice |
|---|---|
| Language | Python 3.11 |
| Package manager | uv — use `uv run` for everything, never call `python` or `pip` directly |
| API | FastAPI — `async def` endpoints |
| ORM | SQLAlchemy 2.x sync — plain `Session`, no `AsyncSession` |
| DB driver | psycopg2-binary |
| Database | PostgreSQL 15 |
| Migrations | Alembic |
| Auth | OAuth2 Password flow + JWT (`python-jose`, `passlib[bcrypt]`) |
| Task queue | Celery 5 + Redis 7 |
| Frontend | React + Vite — runs outside Docker on port 5173 |
| Containers | Docker Compose — 4 services: db, redis, api, worker |

---

## Project structure

```
order-processing/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── security.py
│   │   ├── dependencies.py
│   │   ├── tasks.py
│   │   └── routers/
│   │       ├── auth.py
│   │       ├── orders.py
│   │       └── users.py
│   ├── alembic/
│   ├── tests/
│   ├── pyproject.toml
│   ├── uv.lock
│   └── alembic.ini
├── frontend/
│   └── src/
├── docker-compose.yml
└── CLAUDE.md
```

---

## How to run

```bash
# Start backend services
docker compose up --build

# Run frontend separately
cd frontend && npm install && npm run dev

# Generate a migration
uv run alembic revision --autogenerate -m "description"

# Apply migrations
uv run alembic upgrade head

# Run tests
uv run pytest
```

---

## Behaviour rules

### Before making changes
- **Small fixes** (typos, renaming, adding a missing import, single-line logic fix): just do it.
- **Major changes** (new files, schema changes, new endpoints, refactoring a module, changing a dependency): stop and ask first. Describe what you plan to do and why before touching anything.
- When in doubt about whether something counts as major: ask.

### When unsure about something
**Stop and ask.** Do not guess, do not leave a TODO and proceed. If a requirement is ambiguous or two valid approaches exist, surface the question clearly before writing any code.

### After making changes
Give a short summary — what changed and which files were affected. No long explanations unless asked.

### Tests
Do not write tests unless explicitly asked to. When asked, use `pytest` and `httpx TestClient`.

---

## Code style

### General
- **Readability over cleverness.** Prefer clear, obvious code over compact or clever one-liners.
- Use descriptive variable names. Avoid abbreviations unless they are universally understood (`db`, `id`, `req`).
- One responsibility per function. If a function is doing two things, split it.
- No commented-out code. Delete it or don't include it.

### Python
- Type hints on all function signatures — parameters and return types.
- Use `from __future__ import annotations` at the top of files with forward references.
- Pydantic v2 style: `model_config = ConfigDict(from_attributes=True)`, not `class Config`.
- Use `Enum` for all status/role fields — never raw strings.
- All UUIDs generated Python-side with `default=uuid.uuid4` — never `server_default`.

### FastAPI
- All route functions are `async def`.
- All DB dependencies (`get_db`) are plain `def` generators — FastAPI runs them in a threadpool automatically.
- Use `Depends()` for auth, never manual token parsing inside route functions.
- Return Pydantic response models explicitly — never return raw ORM objects.

### SQLAlchemy
- Sync session only. No `AsyncSession`, no `await` on DB calls.
- Always use `with Session(engine) as db:` in Celery tasks — never leave sessions open.
- `db.flush()` to get generated PKs mid-transaction, `db.commit()` once at the end.

### Celery
- Tasks must be idempotent — always check current status before updating.
- `apply_async(countdown=300)` is called **after** `db.commit()`, never before.
- `acks_late=True` on all tasks.

---

## Architecture decisions (do not change without asking)

These decisions were made deliberately. Do not reverse them without raising it first.

| Decision | Reason |
|---|---|
| Sync SQLAlchemy, async FastAPI endpoints | Simpler session management, no dual-engine setup, Alembic works out of the box |
| `apply_async(countdown=300)` per order, no Celery Beat | Each order carries its own timer — no polling sweep, more precise |
| No Nginx | Unnecessary for this scope; CORS handles cross-origin between Vite and FastAPI |
| UUID PKs generated Python-side | PK must be available before DB commit for task enqueueing |
| Single `DATABASE_URL` for both API and Celery | Both are sync — no need for separate async/sync URLs |
| Frontend runs outside Docker | Simpler dev setup; Vite HMR works better outside a container |

---

## Critical gotchas

1. **CORS is required.** `CORSMiddleware` must be on `main.py` with `allow_credentials=True`. Without it, the browser blocks every request with an `Authorization` header.

2. **Session leaks in Celery.** Workers are long-lived. Always use `with Session(engine) as db:` — never open a session without a context manager.

3. **`apply_async` after commit.** If you enqueue before `db.commit()`, the worker may read a row that doesn't exist yet.

4. **Alembic needs all models imported in `env.py`.** If a model isn't imported before `target_metadata` is set, Alembic won't detect it and will silently skip it.

5. **`--frozen` in Docker.** Always `uv sync --frozen` in the Dockerfile. Without it, uv ignores the lockfile and resolves fresh versions.

6. **`allow_credentials=True` in CORS.** Required when requests include an `Authorization` header. Missing this breaks preflight silently.

7. **Cancelled orders are terminal.** The Celery task must check `if order.status != OrderStatus.PENDING: return` before doing anything — an order may be cancelled before the 5-minute timer fires.

---

## Environment variables

All injected via `.env` (never hardcoded). The `.env` file is gitignored.

```
DATABASE_URL=postgresql+psycopg2://orders_user:password@db:5432/orders_db
REDIS_URL=redis://redis:6379/0
JWT_SECRET=<min 32 chars, random>
JWT_EXPIRE_MINUTES=30
DB_PASSWORD=<postgres password>
```