# Order Processing System — Build Plan

Steps follow the dependency order you specified. Each step lists what to create, which files are touched, and whether parallel subagents can safely tackle it alongside another step.

---

## Legend
- `[ ]` not started
- `[~]` in progress
- `[x]` done
- **PAR** — safe to run in parallel with the step(s) noted

---

## Phase 0 — Project scaffold
> One-time setup. Must finish before anything else.

- [x] **0.1** Create directory tree
  - `backend/app/`, `backend/app/routers/`, `backend/alembic/`, `backend/tests/`, `frontend/src/`
- [x] **0.2** Init `pyproject.toml` + `uv.lock`
  - `backend/pyproject.toml`
  - Run: `uv sync`
- [x] **0.3** Create root `.env` (gitignored) + `.gitignore`
  - `.env`, `.gitignore`

**No parallelism yet — everything downstream depends on this.**

---

## Phase 1 — Pydantic models (`schemas.py`)
> Pure Python, no DB or ORM dependency. First thing to write.

- [x] **1.1** Define shared enums: `UserRole`, `OrderStatus`
  - `backend/app/enums.py` ← put enums here so both schemas and ORM models import from one place
- [x] **1.2** Write all Pydantic schemas
  - `backend/app/schemas.py`
  - `UserCreate`, `UserResponse`, `Token`, `TokenData`
  - `OrderItemCreate`, `OrderItemResponse`
  - `OrderCreate`, `OrderResponse`, `OrderStatusUpdate`

**PAR with Phase 2** — schemas and ORM models don't import each other (both import `enums.py`). Two subagents can write them simultaneously once `enums.py` exists.

---

## Phase 2 — SQLAlchemy setup (`models.py` + `database.py`)
> ORM model definitions and engine/session factory. No live DB needed yet.

- [x] **2.1** Write `database.py`
  - `backend/app/database.py`
  - Sync engine from `DATABASE_URL`, `SessionLocal`, `Base`, `get_db` generator
- [x] **2.2** Write `models.py`
  - `backend/app/models.py`
  - `User`, `Order`, `OrderItem` ORM classes; import enums from `enums.py`
  - All UUID PKs via `default=uuid.uuid4` (Python-side, never `server_default`)

**PAR with Phase 1** — after `enums.py` is written, schemas (Phase 1.2) and models (Phase 2.2) can be written by two parallel subagents without touching each other's files.

---

## Phase 3 — DB infrastructure setup
> Docker Compose, Dockerfile, `.env`. No code logic — pure config files.

- [x] **3.1** Write `docker-compose.yml`
  - 4 services: `db`, `redis`, `api`, `worker`
  - Redis with `--appendonly yes` (AOF persistence)
  - `api` runs `alembic upgrade head && uvicorn ...`
  - No Nginx
- [x] **3.2** Write `backend/Dockerfile`
  - `uv sync --frozen --no-dev` pattern (copy `pyproject.toml` + `uv.lock` first for layer cache)
- [x] **3.3** Populate `.env` with all required variables
  - `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRE_MINUTES`, `DB_PASSWORD` (done in Phase 0)

**PAR with Phases 1 and 2** — config files are completely independent of Python source files. A third subagent can write these while two others write schemas and models.

**Verify Phase 3:** `docker compose up db redis` — Postgres and Redis should start and stay healthy.

---

## Phase 4 — Alembic migrations
> Depends on Phase 2 (models must exist) and Phase 3 (DB must be reachable).

- [x] **4.1** Init Alembic
  - Run: `uv run alembic init alembic` inside `backend/`
- [x] **4.2** Wire `env.py`
  - `backend/alembic/env.py`
  - Import `Base`, `engine` from `app.database`; import `app.models` (noqa) so all tables are visible
  - Override `sqlalchemy.url` from `os.environ["DATABASE_URL"]`
- [x] **4.3** Generate initial migration
  - Run: `uv run alembic revision --autogenerate -m "initial_schema"`
  - Review the generated file — confirm `users`, `orders`, `order_items` tables appear
- [x] **4.4** Apply migration
  - Run: `uv run alembic upgrade head`
  - Verify with `psql` or `docker exec`: all three tables present

**No parallelism** — sequential dependency chain (models → env.py → generate → apply).

---

## Phase 5 — Services / security layer
> Business logic that has no DB calls — pure functions. Depends on enums + schemas being defined.

- [x] **5.1** Write `security.py`
  - `backend/app/security.py`
  - `hash_password`, `verify_password` (bcrypt directly — passlib dropped, incompatible with bcrypt 4x+)
  - `create_access_token`, `decode_token` (python-jose HS256)
  - Read `JWT_SECRET` from env; raise HTTP 401 on invalid/expired token
- [x] **5.2** Write `dependencies.py`
  - `backend/app/dependencies.py`
  - `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")`
  - `get_current_user` (async) — decodes token, fetches user from DB
  - `require_admin` (async) — checks `UserRole.admin`, raises 403 otherwise

**PAR:** `security.py` (5.1) and `dependencies.py` (5.2) have no overlap — safe to write in parallel. Both depend on enums and schemas being done (Phases 1–2).

---

## Phase 6 — Celery task (`tasks.py`)
> The worker logic. Depends on models and `database.py` being done.

- [x] **6.1** Write `tasks.py`
  - `backend/app/tasks.py`
  - `celery_app` configured with `broker=REDIS_URL`, `backend=REDIS_URL`
  - `auto_process_order` task: `acks_late=True`, `bind=True`, `max_retries=3`
  - Always `with Session(engine) as db:` — never open session without context manager
  - Guard: `if order.status != OrderStatus.PENDING: return` (idempotent)

**PAR with Phase 5** — `tasks.py` and `security.py`/`dependencies.py` touch different files entirely. Safe to run in parallel once Phases 1–3 are done.

---

## Phase 7 — API routers + app factory
> All HTTP endpoints. Depends on everything above being in place.

- [x] **7.1** Write `routers/auth.py`
  - `POST /auth/register` — creates customer account
  - `POST /auth/token` — OAuth2 form body → JWT
- [x] **7.2** Write `routers/orders.py`
  - `POST /orders` — create order, `db.flush()` for id, `db.commit()`, then `apply_async` after commit
  - `GET /orders` — role-scoped query (customer sees own, admin sees all); optional `?status=` filter
  - `GET /orders/{id}` — ownership check for customers
  - `PATCH /orders/{id}/status` — admin only
  - `DELETE /orders/{id}/cancel` — PENDING only, ownership check
- [x] **7.3** Write `routers/users.py`
  - `GET /users/me` — authenticated
  - `GET /users` — admin only
- [x] **7.4** Write `main.py`
  - FastAPI app factory
  - Register all three routers
  - Add `CORSMiddleware`: `allow_origins=["http://localhost:5173"]`, `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`

**PAR:** Routers 7.1, 7.2, 7.3 touch separate files — three subagents can write them simultaneously. `main.py` (7.4) must wait until all three routers exist.

**Verify Phase 7:** `docker compose up --build` → `http://localhost:8000/docs` loads OpenAPI UI with all endpoints. ✓ 25/25 endpoint tests passed live.

---

## Phase 7.5 — Service layer between routers and DB
> Refactor: extract business logic + DB access out of routers into `app/services/`. Routers become thin (auth deps + response models only).

- [x] **7.5.1** Write `app/exceptions.py`
  - `AppError` base (carries `status_code`) + `NotFoundError` (404), `ForbiddenError` (403), `BadRequestError` (400), `AuthError` (401)
- [x] **7.5.2** Write `app/services/auth_service.py`
  - `register_customer`, `login` — moved from `routers/auth.py`
- [x] **7.5.3** Write `app/services/order_service.py`
  - `_ORDER_LOAD`, `create_order`, `list_orders`, `get_order_for_user`, `update_status`, `cancel_order` — moved from `routers/orders.py`
- [x] **7.5.4** Write `app/services/user_service.py`
  - `list_users` — moved from `routers/users.py`
- [x] **7.5.5** Slim down all three routers to delegate to services
- [x] **7.5.6** Add `AppError` exception handler in `main.py` — translates domain exceptions to `{"detail": ...}` JSON with the right status code

**PAR:** `auth_service.py`, `order_service.py`, `user_service.py` touch separate files — safe to write in parallel once `exceptions.py` exists.

**Verify:** Rebuilt `api`+`worker` (no volume mount, so `--reload` doesn't see host changes — rebuild required). Re-ran the 25-case suite plus a new 404-shape check → 26/26 passed.

---

## Phase 8 — Frontend (React + Vite)
> Completely independent of backend code (calls it over HTTP). Can start any time after Phase 3 confirms the API shape.

- [x] **8.1** Scaffold Vite project, install deps: `axios`, `react-router-dom` (hand-written scaffold; styling ported from design handoff prototype CSS, no Tailwind/react-hot-toast needed)
- [x] **8.2** `api/orders.js` — axios instance, interceptors, all API call functions
- [x] **8.3** `context/AuthContext.jsx` — token state, user fetched via `GET /users/me` (JWT only carries `sub`+`role`, no email), login/logout
- [x] **8.4** `PrivateRoute.jsx`, `AdminRoute.jsx`
- [x] **8.5** Pages: `LoginPage`, `RegisterPage`
- [x] **8.6** Pages: `CustomerOrdersPage`, `NewOrderPage`
- [x] **8.7** Pages: `AdminOrdersPage`, `AdminUsersPage`
- [x] **8.8** Components: `Navbar`, `OrderCard` (handles both customer/admin via `isAdmin` prop), `OrderForm`, `StatusBadge`, `StatusFilter`, `AdminStatusPatch`, `Toast`

**Verify:** `npm install` + `npm run dev` — Vite serves cleanly on :5173. Verified the full API contract against the live backend via curl (register → login → /users/me → create order → list → cancel, plus admin /orders and /users) — all field names (`product_name`/`quantity`/`price`, `owner.email`, numeric-string `price`) match the frontend code.

---

## Parallel subagent map (summary)

| When | Agents | What each does |
|---|---|---|
| After Phase 0 + enums.py | Agent A + Agent B | A writes `schemas.py`, B writes `models.py` + `database.py` |
| Same window | Agent C | Writes `docker-compose.yml`, `Dockerfile`, `.env` |
| After Phase 5+ | Agent A + Agent B | A writes `security.py`, B writes `tasks.py` |
| After Phase 5 | Agents A + B + C | A writes `routers/auth.py`, B writes `routers/orders.py`, C writes `routers/users.py` |
| Any time after Phase 3 | Frontend agent | Entire frontend in parallel with backend Phases 5–7 |

---

## End-to-end verification checklist

- [ ] `docker compose up --build` — all 4 services healthy
- [ ] `POST /auth/register` → 201
- [ ] `POST /auth/token` → JWT returned
- [ ] `POST /orders` → order created, Celery task enqueued (check worker logs)
- [ ] Wait 5 min → order status becomes `PROCESSING` automatically
- [ ] `DELETE /orders/{id}/cancel` on PENDING order → 200; on PROCESSING → 400
- [ ] Customer cannot see another customer's orders
- [ ] Admin can see all orders, patch status
- [ ] Frontend: login → redirect by role; cancel button only on PENDING; 10s polling updates status
