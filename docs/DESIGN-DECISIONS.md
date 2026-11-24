# Design decisions: what changed from the brief, and why

The brief (`digital_shopkeeper_agent_handoff`) is the contract. The narrow promise is unchanged: **maintain products, record a sale, calculate stock, publish shop status, show it on a customer page.** Everything below either serves that loop or makes it trustworthy.

## Kept as specified
Fictional Alex Corner Shop; owner / staff / customer roles; seeded accounts; owner dashboard with KPIs; product create / edit / archive / restore; inventory search and filtering with low and out-of-stock highlighting; open / closed / temporarily unavailable status with a message; announcements that can be ended; staff sales flow with plain-language errors; **atomic** sale + stock decrement; public page with In stock / Low stock / Out of stock; copyable message instead of paid messaging; static frontend + API + PostgreSQL; Render blueprint; honest free-tier notes; acceptance checklist.

## Changed (improvements)
| Brief | Built | Why |
|---|---|---|
| React/Vite + Node/Express *or equivalent* | **Angular 20 + FastAPI**, same architecture | The brief allows an equivalent stack as long as it stays static frontend + API + PostgreSQL, and this matches the CyberShield stack and standards. |
| Sale = one product + quantity | **A basket** of several products in one sale | A real customer buys bread *and* milk. `sale_items` already existed in the model. |
| `stock_qty` editable on the product | Stock changes only via **sales** and **Adjust stock**, each logged | Editing a number silently destroys the audit trail. The brief asks for "audit-friendly records". |
| Free-text `hours` | **Structured weekly hours** | Lets the page highlight today's hours and the owner edit them properly. |
| No customer slug in the data model | `businesses.slug` | `GET /public/business/:slug` needs it. |
| "Featured-availability list" | `is_featured` flag per product | The owner chooses what customers see. |
| `/api/...` | `/api/v1/...` | Versioning, as in CyberShield. |
| Plain `{detail}` / mixed errors | One error envelope with codes and correlation ids | "Return consistent JSON errors." |
| Short-lived token only | Access + **rotating refresh** token, reuse detection, login throttling | Better security with no extra cost to the user. |
| Retry on a bad connection unspecified | **Idempotent sales** (`client_ref`) | The brief stresses inconsistent connectivity; a duplicate sale would corrupt stock. |
| First request may be slow (README note only) | A **"waking up the demo server" banner** in the app | The limitation is shown where the person sees it. |
| Material-style component library (CyberShield) | Hand-built components on native `<dialog>`, no UI library, no chart library | The brief stresses low data volume. Result: ~118 kB gzipped initial load. |
| `seed/` at repo top level | Seed lives in `backend/app/seed` | The Docker build context is `backend/`; the seed runs from the same image. It is idempotent. |

## Added (not in the brief)
Dashboard best sellers and a 7-day sales chart · QR code and shareable link · "waking up" banner · stock ledger and activity log · dark/light theme · keyboard focus states, skip link, labelled controls, text-plus-icon status badges (never colour alone) · mobile bottom tab bar and a basket sheet for thumb use · health + readiness endpoints · CI workflow · Docker Compose fallback.

## Removed / deliberately not built
- **Marketing content on the homepage** (explainer sections and the in-browser demo): the project owner presents the product in a demonstration video, so the homepage is just the brand, the product name and two entry buttons.
- **Per-product editing of stock** (replaced by adjustments).
- **Void / refund** of a sale: kept out to protect the narrow scope; adjustments cover corrections.
- **Analytics and forecasting** beyond the two owner charts: the brief says they "should follow validated data collection".
- **Any real messaging, payment, or location integration**, per the non-goals.

## Honest gaps against the brief's deliverables
The brief asks the implementation agent to return a private repo URL, a deployed frontend URL and a live health-check URL. Those need a GitHub account and Render account, which this build did not have access to, so **no live URLs exist yet**. Everything needed is here: `render.yaml`, the step-by-step in the README, and the local fallback.
