# Digital Shopkeeper's Assistant

A small web app for township shops. Staff record sales and **stock updates instantly**; the owner sees what is running low and controls the shop's **open / closed / temporarily unavailable** status; customers open **one public page** to see live status, hours, announcements and availability before they travel. Customers can also place food orders directly from the public page, and the owner manages them through a queue on the dashboard.

> **Prototype.** One fictional shop (*Alex Corner Shop*, Alexandra, Johannesburg), fictional people, fictional data. No real payments, SMS, WhatsApp, customer data or street addresses.

**The one-sentence pitch:** a shop assistant records a sale in a few taps, the stock count drops straight away, the owner gets the low-stock warning, and customers stop phoning or walking over to ask if you are open or have bread.

---

## Demo credentials (fictional)

| Role | Email | Password |
|---|---|---|
| Owner | `owner@alexcorner.demo` | `Owner#Demo2027` |
| Staff | `staff@alexcorner.demo` | `Staff#Demo2027` |
| Customer | no account | open `/shop/alex-corner-shop` |

The login page has one-tap buttons that fill these in. Change the passwords with `SEED_OWNER_PASSWORD` / `SEED_STAFF_PASSWORD` for anything beyond a private demo.

---

## Run it

### Option A: Docker (one command)
```bash
docker compose up --build
# app:  http://localhost:8081        API docs: http://localhost:8001/docs
```

### Option B: no Docker, PostgreSQL installed
```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env            # edit DATABASE_URL to your PostgreSQL
alembic upgrade head            # create the tables
python -m app.seed.run          # fictional demo shop (safe to re-run; add --reset to rebuild)
uvicorn app.main:app --reload   # http://127.0.0.1:8000/docs

cd ../frontend
npm ci
npm start                       # http://localhost:4200
```

### Option C: no Docker, no PostgreSQL (SQLite, quickest)
Same as B, but set in `backend/.env`: `DATABASE_URL=sqlite+aiosqlite:///./dev.db`.

---

## Architecture
```
Browser (Angular static site)  ──HTTPS/JSON──▶  FastAPI service  ──▶  PostgreSQL
  public customer page (no login)                 auth · roles · products · sales
  staff: sell, stock lookup, my sales             stock maths · status · announcements
  owner: dashboard, inventory, shop page          audit log · health checks
  customer: order food, view queue status         orders · queue management
```

Backend layout: `api/v1/endpoints` (thin HTTP) → `services` (rules, transactions) → `models` (SQLAlchemy). `security/` holds JWT, passwords, role checks. `schemas/` are the API contract. Frontend layout: `core/` (auth, interceptors, guards, services, utils), `shared/` (components), `layouts/`, `features/`.

### Stack
- **Frontend:** Angular 20, standalone components, signals, lazy routes, guards, interceptors
- **Backend:** FastAPI, async SQLAlchemy 2, Alembic, PostgreSQL
- **Auth:** JWT access + rotating refresh tokens, bcrypt, role/permission checks with refresh-token reuse detection
- **Errors:** Correlation IDs, one consistent error shape for every error (`{error:{code,message,details,correlation_id}}`)

### Data model
`businesses` · `users` · `refresh_tokens` · `products` · `sales` · `sale_items` · `stock_movements` · `announcements` · `audit_logs` · `orders`. Money is stored as whole **cents** (integers). `sale_items` copies the product name and price at the moment of sale so history never changes when a price does.

### API (all under `/api/v1`; interactive docs at `/docs`)
| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| POST | `/auth/login` · `/auth/refresh` · `/auth/logout` | public | Sign in, rotate tokens, sign out |
| GET | `/auth/me` | signed in | Current user, shop, permissions |
| GET | `/products` | owner, staff | Active products with stock state |
| POST · PATCH | `/products` · `/products/{id}` | owner | Create / edit |
| POST | `/products/{id}/archive` · `/restore` | owner | Archive / restore |
| POST | `/products/{id}/stock-adjustments` | owner | Restock / correct / damaged |
| POST | `/sales` | owner, staff | Record a sale (atomic), **409** if over stock |
| GET | `/sales?period=` | owner (all), staff (own only) | History |
| GET | `/dashboard/summary` | owner | KPIs, low stock, best sellers, 7-day chart |
| GET | `/business` | owner, staff | Shop record |
| PATCH | `/business/status` · `/business/profile` | owner | Status + message; name, area, hours |
| GET · POST · PATCH | `/announcements` · `/{id}/end` | owner | Announcements |
| GET | `/activity` | owner | Audit log |
| GET | `/public/business/{slug}` | **public** | Customer-safe page data only |
| POST | `/orders` | **public** | Place a food order |
| GET | `/orders` | owner, staff | View the order queue |
| PATCH | `/orders/{id}/done` | owner, staff | Mark an order as done |
| GET | `/health` · `/ready` | public | Liveness · database reachable |

Status codes: **401** missing/invalid token, **403** wrong role, **404** not found, **409** sale exceeds stock, **422** invalid input, **429** too many sign-in attempts.

### How the important guarantees are met
- **A sale and its stock change are one transaction.** Product rows are locked, every line is checked first, then stock drops and the sale is saved together. If one line is short, nothing moves.
- **No double sales on a bad connection.** The browser sends a `client_ref` with each sale; a retry returns the sale already recorded instead of making a second one.
- **Roles are enforced on the server.** Every endpoint declares the permission it needs. The user's role is read from the database on each request, not trusted from the token.
- **The public page can't leak private data.** It is assembled field by field: availability states only (never counts), no product IDs, no sales, no staff names.
- **Stock counts have a history.** Every stock change writes a `stock_movements` row. The ledger replays to the exact current stock count.

---

## Deploy on Render (free plan)

`render.yaml` defines everything. To deploy from scratch:

1. Push this folder to a GitHub repository.
2. Render → **New → Blueprint** → select the repo → *Apply*.
3. Wait for the first deploy. The API waits for the database, runs migrations, seeds the demo shop, and starts.
4. Open `https://shopkeeper-web.onrender.com`; health check: `https://shopkeeper-api.onrender.com/api/v1/health`.

**Free-tier limitations:**
- A free web service sleeps after 15 minutes without traffic; the next request can take about a minute.
- Open the app a few minutes before a live demo so it is awake.

---

## Tests
```bash
# Backend
cd backend && pytest -q

# Frontend (needs Chrome)
cd frontend && npx ng test --watch=false
```
Last run: backend **50 passed, 1 skipped**; frontend **24 passed**.

---

## Known limitations
- Prototype, one shop in the UI. The schema is multi-business ready; onboarding and per-shop admin are not built.
- Sign-in throttling is in memory per process. Multiple API instances would need a shared store.
- Sales can't be voided or refunded yet; stock mistakes are fixed with *Adjust stock*.
- No offline queue: with no connection a sale is not recorded. Offline-first is a natural next step.
- No password reset or user management screen; accounts are seeded.
- Food order notifications (SMS/WhatsApp) are not implemented — they require paid integrations.

## Next steps
Offline-first sale queue · void/refund with reasons · SMS/WhatsApp order notifications · supplier reorder suggestions from real sales history · multiple shops and branches · password reset screen · production hardening.
