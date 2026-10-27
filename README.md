# Sales & Inventory Management System

A full-stack **Sales & Inventory Management System** built with **React.js**,
**FastAPI / Python**, and **MySQL**. It manages products and customers, creates
sales orders with stock validation, runs an **amount-based manager approval
workflow** with **email notifications**, updates inventory **transactionally**,
and surfaces everything on a **dashboard**.

---

## Features

- **Authentication & roles** — JWT auth with three roles: `SALES`, `MANAGER`, `ADMIN`. Role-based route guards on the API and in the UI.
- **User management** — admins can create users, change roles, reset passwords, and enable/disable accounts from a dedicated screen.
- **Products & inventory** — CRUD, low-stock flagging, and manual stock adjustments with a full **stock-movement audit trail** (viewable per product in the UI).
- **Invoice PDFs** — download a formatted PDF invoice for any order.
- **Schema migrations** — database schema is versioned and applied with **Alembic**.
- **Customers** — create, search, and manage customers.
- **Sales orders** — multi-line orders with live totals and per-line stock validation.
- **Approval workflow** — orders **above a configurable amount threshold** are held as `PENDING_APPROVAL`; managers approve or reject.
- **Email notifications** — the manager is emailed when approval is needed; the sales rep is emailed on the decision. Console backend by default (works offline); SMTP configurable via env.
- **Transactional fulfilment** — inventory is deducted inside a single DB transaction with **row-level locking** (`SELECT … FOR UPDATE`) so concurrent orders can't oversell.
- **Dashboard** — total sales, order counts by status, pending approvals, low-stock alerts, recent orders, and top-selling products.

---

## Tech stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 18, Vite, React Router, Axios |
| Backend  | FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| Database | MySQL 8.4 |
| Auth     | JWT (python-jose), bcrypt (passlib) |
| Infra    | Docker Compose, nginx |

---

## Quick start (Docker — recommended)

Requires Docker Desktop.

```bash
docker compose up --build
```

This starts MySQL, the FastAPI backend (which waits for the DB, creates tables,
and seeds demo data), and the React app served by nginx.

| Service        | URL |
|----------------|-----|
| **Web app**    | http://localhost:8080 |
| **API**        | http://localhost:8000 |
| **API docs**   | http://localhost:8000/docs |

### Demo accounts

| Role    | Email              | Password     |
|---------|--------------------|--------------|
| Admin   | `admin@sims.io`    | `admin123`   |
| Manager | `manager@sims.io`  | `manager123` |
| Sales   | `sales@sims.io`    | `sales123`   |

> Emails (approval requests & decisions) are printed to the **backend logs** and
> appended to `backend/logs/sent_emails.log`. Watch them with:
> ```bash
> docker compose logs -f backend
> ```

---

## Try the approval workflow

1. Sign in as **Sales** (`sales@sims.io`).
2. **Sales Orders → New Order.** Pick a customer and products.
   - A small order (total ≤ **$1,000**) is **auto-completed** and stock is deducted immediately.
   - A large order (total > **$1,000**) is created as **PENDING_APPROVAL** — stock is *not* yet deducted. An approval email is logged to the manager.
3. Sign in as **Manager** (`manager@sims.io`). Open **Approvals**.
4. **Approve** → inventory is deducted transactionally and the order is **COMPLETED**; the sales rep gets a decision email.
   **Reject** → inventory is untouched; the sales rep is notified.

The approval threshold is configurable via `APPROVAL_THRESHOLD` (see
`docker-compose.yml` / `backend/.env.example`).

---

## Local development (without Docker)

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # point DATABASE_URL at your MySQL
alembic upgrade head            # apply schema migrations
python -m app.seed              # demo data
uvicorn app.main:app --reload   # http://localhost:8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173 (proxies /api -> :8000)
```

---

## Database migrations

Schema is managed by **Alembic** (`backend/migrations/`). Under Docker the
backend runs `alembic upgrade head` automatically on startup before seeding.

```bash
cd backend
alembic upgrade head                              # apply migrations
alembic revision --autogenerate -m "add x column" # create a new migration after model changes
alembic downgrade -1                              # roll back one revision
```

---

## Tests

Backend tests cover the full order/approval/inventory workflow and run against an
in-memory SQLite DB (no MySQL needed):

```bash
cd backend
pip install -r requirements.txt
pytest
```

Covered: login, auto-complete below threshold (+ stock deduction), hold above
threshold (no deduction), manager approval (deduction), rejection (no change),
role enforcement (sales can't approve), insufficient-stock rejection, user
management (admin-only, self-deactivation guard), stock-movement recording, and
invoice PDF generation. **13 tests**, all passing.

---

## Architecture

```
┌────────────┐      /api (proxy)      ┌─────────────┐     SQLAlchemy    ┌────────┐
│  React SPA │ ─────────────────────► │  FastAPI    │ ────────────────► │ MySQL  │
│ (nginx)    │ ◄───────────────────── │  backend    │ ◄──────────────── │        │
└────────────┘       JSON + JWT       └─────────────┘                   └────────┘
                                            │
                                            ▼  BackgroundTasks
                                      Email service (console / SMTP)
```

### Backend layout
```
backend/app
├── core/          config, DB engine/session, security (JWT + hashing)
├── models/        SQLAlchemy models + enums
├── schemas/       Pydantic request/response models
├── services/      business logic (order_service), email, domain exceptions
├── api/           deps (auth/role guards) + routes
└── tests/         pytest workflow tests
```

### Key design decisions

- **Service layer** holds all business rules (`services/order_service.py`); routes stay thin and HTTP-focused.
- **Inventory is only deducted inside `_fulfill_order`**, which locks product rows and commits atomically — a short line rolls the whole order back, so orders are never partially fulfilled.
- **Pending orders don't reserve stock**; stock is re-validated at approval time, which is why approval can still fail if stock ran out meanwhile.
- **Money uses `Numeric(12,2)`** (not floats) end-to-end for exact arithmetic.
- **`StockMovement`** is an append-only ledger of every inventory change for auditability.
- **Email is pluggable & non-blocking** via `BackgroundTasks`; a failed send never breaks the business action.
- **Roles enforced server-side** with a `require_roles(...)` dependency factory; the UI mirrors this but the API is the source of truth.

---

## Main API endpoints

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/login` | public | Log in, get JWT |
| GET  | `/api/auth/me` | any | Current user |
| POST | `/api/auth/register` | admin | Create a user |
| GET  | `/api/auth/users` | admin | List users |
| PATCH | `/api/auth/users/{id}` | admin | Update role / status / password |
| GET/POST | `/api/products` | any / manager | List / create products |
| POST | `/api/products/{id}/adjust-stock` | manager | Restock / correct inventory |
| GET  | `/api/products/{id}/movements` | any | Stock-movement history |
| GET/POST | `/api/customers` | any | List / create customers |
| GET/POST | `/api/orders` | any | List / create orders |
| GET  | `/api/orders/pending` | manager | Approval queue |
| GET  | `/api/orders/{id}/invoice` | owner/manager | Download invoice PDF |
| POST | `/api/orders/{id}/approve` | manager | Approve → fulfil → complete |
| POST | `/api/orders/{id}/reject` | manager | Reject |
| POST | `/api/orders/{id}/cancel` | owner/admin | Cancel a pending order |
| GET  | `/api/dashboard/summary` | any | Dashboard metrics |

Full interactive docs at `/docs`.

---

## Order status lifecycle

```
            total ≤ threshold
 create ────────────────────────► COMPLETED   (stock deducted immediately)
   │
   │ total > threshold
   ▼
 PENDING_APPROVAL ──approve──► COMPLETED       (stock deducted on approval)
   │        │
   │        └────reject─────► REJECTED         (no stock change)
   │
   └────────cancel─────────► CANCELLED         (by creator, while pending)
```
