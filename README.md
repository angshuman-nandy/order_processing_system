# Order Processing System

An e-commerce order processing backend (FastAPI + PostgreSQL + Redis + Celery) with a React + Vite
frontend. Customers place orders, track status, and cancel pending orders. Admins manage all
orders and users. A Celery worker automatically advances each order from `PENDING` →
`PROCESSING` exactly 5 minutes after creation (`apply_async(countdown=300)`).

---

## Architecture & Flow Diagrams

The interactive diagrams (Architecture, Auth & Order Flow, Data Model — hover nodes for details)
live at <a href="frontend/design_handoff/diagrams.html" target="_blank" rel="noopener noreferrer">frontend/design_handoff/diagrams.html</a>. Open
that file directly in a browser for the live version.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Language | Python 3.11 |
| Package manager | [uv](https://github.com/astral-sh/uv) — `uv run` for everything |
| API | FastAPI (`async def` endpoints) |
| ORM | SQLAlchemy 2.x — sync `Session`, no `AsyncSession` |
| DB driver | psycopg2-binary |
| Database | PostgreSQL 15 |
| Migrations | Alembic |
| Auth | OAuth2 Password flow + JWT (`python-jose`, `bcrypt`) |
| Task queue | Celery 5 + Redis 7 |
| Frontend | React 18 + Vite 5 + React Router v6 + Axios |
| Containers | Docker Compose — `db`, `redis`, `api`, `worker` (no Nginx) |

---

## Folder Structure

```
order_processing_system/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app factory, CORS, AppError handler
│   │   ├── database.py        # engine, SessionLocal, get_db
│   │   ├── models.py          # ORM models: User, Order, OrderItem
│   │   ├── schemas.py         # Pydantic request/response models
│   │   ├── enums.py           # UserRole, OrderStatus
│   │   ├── security.py        # password hashing, JWT
│   │   ├── dependencies.py    # get_current_user, require_admin
│   │   ├── exceptions.py      # AppError + domain exception subclasses
│   │   ├── tasks.py           # Celery app + auto_process_order task
│   │   ├── routers/           # auth, orders, users — thin HTTP layer
│   │   └── services/          # auth_service, order_service, user_service
│   ├── alembic/                # migrations
│   ├── tests/
│   ├── pyproject.toml / uv.lock
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/orders.js       # axios instance + API calls
│   │   ├── context/AuthContext.jsx
│   │   ├── routes/             # PrivateRoute, AdminRoute
│   │   ├── pages/               # Login, Register, Customer/Admin order & user pages
│   │   ├── components/          # Navbar, OrderCard, OrderForm, Toast, etc.
│   │   └── index.css            # ported design-handoff styles
│   └── design_handoff/          # design assets (prototype.html, diagrams.html, specs)
├── seed_data/                   # seed JSON files + seed.py loader
├── handoffs/                    # original planning/design handoff docs
├── docker-compose.yml           # db, redis, api, worker
├── claude.md                    # Claude Code instructions for this repo
├── progress.md                  # phase-by-phase build checklist
└── transcript.md                # session-by-session change log
```

---

## Running with Docker

1. Copy `.env.example` to `.env` and fill in real values (`JWT_SECRET` min 32 chars, etc.) — `.env` is gitignored.

2. Start the stack:

   ```bash
   docker compose up --build
   ```

   This brings up 4 services:
   - `db` — Postgres 15 (port 5432)
   - `redis` — Redis 7 with AOF persistence
   - `api` — FastAPI on http://localhost:8000, runs `alembic upgrade head` before starting uvicorn
   - `worker` — Celery worker (consumes `auto_process_order` tasks)

3. Seed sample data (users, orders, order items):

   ```bash
   docker compose exec api uv run python /seed_data/seed.py
   ```

   The script is idempotent — safe to re-run, it skips rows that already exist. Seeded accounts:

   | Email | Password | Role |
   |---|---|---|
   | `admin@example.com` | `password` | admin |
   | `customer@example.com` | `password` | customer |

   To promote the seeded customer to admin instead:

   ```bash
   docker compose exec api uv run python /seed_data/seed.py --promote-admin
   ```

   (or `--promote-admin <email>` for a specific user; no-ops if already admin.)

4. Run the frontend separately, outside Docker:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Open http://localhost:5173 and log in with one of the seeded accounts above.

---

## Project Docs

- [`claude.md`](claude.md) — instructions and conventions Claude Code follows in this repo
- [`progress.md`](progress.md) — phase-by-phase build checklist
- [`transcript.md`](transcript.md) — session-by-session log of changes
