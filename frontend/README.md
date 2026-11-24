# Digital Shopkeeper's Assistant

A small web app for township shops. Staff record sales and **stock updates instantly**; the owner sees what is running low and controls the shop's **open / closed / temporarily unavailable** status; customers open **one public page** to see live status, hours, announcements and availability before they travel.

> **Prototype.** One fictional shop (*Alex Corner Shop*, Alexandra, Johannesburg), fictional people, fictional data. No real payments, SMS, WhatsApp, customer data or street addresses. It has **not** been validated with Alexandra residents, and nothing here claims otherwise.

**The one-sentence pitch:** a shop assistant records a sale in a few taps, the stock count drops straight away, the owner gets the low-stock warning, and customers stop phoning or walking over to ask if you are open or have bread.

| Customer page (phone) | Owner dashboard |
|---|---|
| ![Customer page](docs/screenshots/customer-page-mobile.png) | ![Dashboard](docs/screenshots/owner-dashboard.png) |

More screenshots are in [`docs/screenshots`](docs/screenshots): landing page, login, inventory, shop settings, staff sale on mobile, the customer page after the owner's update.

---

## Demo credentials (fictional)

| Role | Email | Password |
|---|---|---|
| Owner | `owner@alexcorner.demo` | `Owner#Demo2027` |
| Staff | `staff@alexcorner.demo` | `Staff#Demo2027` |
| Customer | no account | open `/shop/alex-corner-shop` |

The login page has one-tap buttons that fill these in (`SHOW_DEMO_ACCOUNTS=false` hides them). Change the passwords with `SEED_OWNER_PASSWORD` / `SEED_STAFF_PASSWORD` for anything beyond a private demo.

---

## Run it

### Option A: Docker (one command, the reliable fallback demo)
```bash
docker compose up --build
# app:  http://localhost:8080        API docs: http://localhost:8000/docs
```
> The compose file and Dockerfiles follow standard patterns but were **not run** while this project was built (no Docker in the build environment). Option B and C were run.

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
Same as B, but set in `backend/.env`: `DATABASE_URL=sqlite+aiosqlite:///./dev.db`. Good for a laptop demo; PostgreSQL is what the deployment uses.

---

## Reviewer demonstration script (about 3 minutes)

This is the script from the brief. It is also automated: the whole flow was run in a real browser against the running stack, 18/18 checks passing.

1. Open **`/shop/alex-corner-shop`** logged out. Shop is **Open**, with a list of products. *Cooking oil* shows **Low stock**.
2. Sign in as **staff**. Tap *Cooking oil* twice, **Record sale**.
3. The confirmation shows items, total (R 95.98), time, and the **stock now left** (1 left, Low stock).
4. Sign in as **owner** (another browser or a private window). The dashboard shows the **low-stock warning** and today's sales.
5. **Shop page** → *Temporarily unavailable*, message "Power cut, back at 14:00", publish an announcement.
6. Refresh the public page: the new status, message and announcement are there.
7. On the Shop page, **Copy message**: a ready-made WhatsApp/SMS text with status, availability and link. No messaging service is called; real integrations are intentionally out of scope for a free prototype.
8. Show `render.yaml` / the architecture below, and explain how the same design later supports more shops (every table already carries `business_id`).

Also worth showing: as staff, open `/shop`. You are turned away, and calling the owner API directly returns **403**. Try to sell more than is in stock and you get a plain-language **409**, with no stock changed.

---

## What was built, and how it follows CyberShield's standards

Same engineering and design standards as the CyberShield project, adapted to a much smaller product.

| Area | CyberShield | This project |
|---|---|---|
| Frontend | Angular 20, standalone components, signals, lazy routes, guards, interceptors | Same |
| Backend | FastAPI, async SQLAlchemy 2, Alembic, PostgreSQL | Same |
| Auth | JWT access + rotating refresh tokens, bcrypt, role/permission checks | Same, plus refresh-token **reuse detection** |
| Errors | Correlation IDs, structured errors | One error shape for **every** error (`{error:{code,message,details,correlation_id}}`) |
| Audit | Audit log | Audit log of sign-ins and every owner action, plus a **stock ledger** |
| Visual identity | Navy surfaces, azure→cyan accent, Segoe UI stack, dark default, 52px top bar, two-panel login, gradient CTAs | Same palette, font stack, layout language, dark default with light toggle |
| Quality | Unit tests, CI | 51 backend + 24 frontend tests, CI workflow |

### Architecture
```
Browser (Angular static site)  ──HTTPS/JSON──▶  FastAPI service  ──▶  PostgreSQL
  public customer page (no login)                 auth · roles · products · sales
  staff: sell, stock lookup, my sales             stock maths · status · announcements
  owner: dashboard, inventory, shop page          audit log · health checks
```
Backend layout: `api/v1/endpoints` (thin HTTP) → `services` (rules, transactions) → `models` (SQLAlchemy). `security/` holds JWT, passwords, role checks. `schemas/` are the API contract. Frontend layout: `core/` (auth, interceptors, guards, services, utils), `shared/` (components), `layouts/`, `features/`.

### Data model
`businesses` · `users` · `refresh_tokens` · `products` · `sales` · `sale_items` · `stock_movements` · `announcements` · `audit_logs`. Money is whole **cents** (integers). `sale_items` copies the product name and price **at the moment of sale**, so history never changes when a price does.

### API (all under `/api/v1`; interactive docs at `/docs`)
| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| POST | `/auth/login` · `/auth/refresh` · `/auth/logout` | public | Sign in, rotate tokens, sign out |
| GET | `/auth/me` | signed in | Current user, shop, permissions |
| GET | `/products` | owner, staff | Active products with stock state (owner may include archived) |
| POST · PATCH | `/products` · `/products/{id}` | owner | Create / edit |
| POST | `/products/{id}/archive` · `/restore` | owner | Archive / restore |
| POST | `/products/{id}/stock-adjustments` | owner | Restock / correct / damaged, with a ledger entry |
| POST | `/sales` | owner, staff | Record a sale (atomic), **409** if over stock |
| GET | `/sales?period=` | owner (all), staff (own only) | History |
| GET | `/dashboard/summary` | owner | KPIs, low stock, best sellers, 7-day chart |
| GET | `/business` | owner, staff | Shop record |
| PATCH | `/business/status` · `/business/profile` | owner | Status + message; name, area, hours |
| GET · POST · PATCH | `/announcements` · `/{id}/end` | owner | Announcements |
| GET | `/activity` | owner | Audit log |
| GET | `/public/business/{slug}` | **public** | Customer-safe page data only |
| GET | `/health` · `/ready` | public | Liveness · database reachable |

Status codes: **401** missing/invalid token, **403** wrong role, **404** not found, **409** sale exceeds stock, **422** invalid input, **429** too many sign-in attempts.

### How the important guarantees are met
- **A sale and its stock change are one transaction.** Product rows are locked (`SELECT … FOR UPDATE`, in a fixed order so two sales can't deadlock), every line is checked first, then stock drops and the sale is saved together. If one line is short, nothing moves. A test fires six simultaneous sales for the last unit at real PostgreSQL: exactly one succeeds.
- **No double sales on a bad connection.** The browser sends a `client_ref` with each sale; a retry returns the sale already recorded instead of making a second.
- **Roles are enforced on the server.** Every endpoint declares the permission it needs. A test calls every owner endpoint as staff and as an anonymous user. The user's role is read from the database on each request, not trusted from the token.
- **The public page can't leak.** It is assembled field by field: availability **states** (never counts), no product ids, no sales, no staff. A test scans the response for forbidden fields.
- **Stock counts have a history.** Changes to stock go through sales or *Adjust stock*, each writing a `stock_movements` row. A test proves the ledger replays to the exact stock count.

---

## Deploy on Render (free plan)

`render.yaml` defines everything: a PostgreSQL database, the API web service and the static frontend.

1. Push this folder to a **private GitHub repository**.
2. Render → **New → Blueprint** → select the repo → *Apply*.
3. Wait for the first deploy. The API's start command waits for the database, runs migrations, seeds the demo shop, and starts.
4. Open `https://shopkeeper-web.onrender.com`; health check: `https://shopkeeper-api.onrender.com/api/v1/health`.

**If a service name was already taken**, Render adds a suffix to the URL. Then set `API_URL` on the web service and `CORS_ORIGINS` on the API to the real URLs and redeploy. `JWT_SECRET_KEY` is generated by Render and never committed.

### Free-tier limitations (state these in the presentation)
From Render's documentation ([Deploy for Free](https://render.com/docs/free), [Web Services](https://render.com/docs/web-services)):
- A free web service **sleeps after 15 minutes without traffic**; the next request can take **about a minute**. The app shows a "waking up the demo server" banner instead of looking broken. **Open the app once a few minutes before a live demo.**
- A free PostgreSQL database **expires 30 days after creation** (with a 14-day grace period). Because seeding is idempotent, a fresh database plus a redeploy rebuilds the whole demo. Back up anything you care about, or upgrade for production.
- This is a demonstration deployment, not production.

If the free tier is unreliable on the day, keep Render as the recommended architecture and demo from **Option A or B** locally. The product keeps its backend either way.

---

## Tests
```bash
# Backend (SQLite by default; set TEST_DATABASE_URL for PostgreSQL, which also runs the race-condition test)
cd backend && pytest -q
TEST_DATABASE_URL=postgresql+psycopg://user:pass@localhost/shopkeeper_test pytest -q

# Frontend (needs Chrome; set CHROME_BIN if it is not on PATH)
cd frontend && npx ng test --watch=false
```
Last run: backend **51 passed on PostgreSQL, 50 passed + 1 skipped on SQLite**; frontend **24 passed**; production build **~118 kB gzipped** initial download.

---

## Known limitations
- Prototype, one shop in the UI. The schema is multi-business ready; onboarding, billing and per-shop admin are not built.
- Sign-in throttling is in memory (per process). Several API instances would need a shared store such as Redis.
- Sales can't be voided or refunded yet; stock mistakes are fixed with *Adjust stock*.
- No offline queue: with no connection a sale is not recorded (the screen says so clearly, and a retry is safe). Offline-first is a natural next step.
- No password reset or user management screen; accounts are seeded.
- The customer page is not cached by a CDN; it polls every 30 seconds while open.
- The sandbox where this was built has no Segoe UI, so screenshots show a fallback sans-serif. On Windows the UI uses Segoe UI exactly as CyberShield does.
- Not yet deployed to Render by this build, and Docker Compose not run (see above).

## Next steps
Offline-first sale queue · void/refund with reasons · supplier reorder suggestions from real sales history · WhatsApp/SMS notifications (consent, cost and credential handling first) · multiple shops and branches · production hardening (threat model, monitoring, backups, privacy policy).

See [`docs/DESIGN-DECISIONS.md`](docs/DESIGN-DECISIONS.md) for what was changed from the original brief and why.
