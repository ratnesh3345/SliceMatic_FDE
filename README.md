# SliceMatic — Full-Stack Ordering System (V3)

A complete pizza ordering + kitchen-management system for SliceMatic, built with Next.js.
Customers order on a clean storefront; staff manage every order through its lifecycle on a live
dashboard; and WhatsApp messages fire automatically — on order, and again when it goes out for delivery.

**No external database or account needed.** Orders are stored in a simple local file
(`data/orders.json`). The data layer is isolated in `lib/store.js`, so it can later be swapped for
Supabase/Postgres without touching the UI.

---

## What it does

**Customer storefront (`/`)**
- Name, phone, and full delivery address (with optional "use my location" pin)
- Build a multi-pizza cart — crust + pizza + optional topping + quantity, add as many as you like
- Live thermal-receipt bill: 10% discount on 5+ pizzas, 18% GST on the post-discount total
- Cash / Card / UPI, with a simulated "authorising payment" step for Card & UPI
- AI recommendation (optional, via OpenRouter) based on past orders

**Kitchen dashboard (`/admin`)**
- Simple password sign-in (no external auth)
- Live order feed (refreshes every 5s) with status badges
- Move each order through its lifecycle: **Placed → Accepted → Out for delivery → Delivered**
- Revenue, order count, active orders, top pizza, busiest hour; CSV export; date/status/payment filters

**WhatsApp automation (via n8n)**
- On **order placed** → confirmation to the customer + full ticket (with address) to staff
- On **out for delivery** → "your order is on its way" message to the customer

---

## Quick start (local — this is all you need)

```bash
npm install
npm run dev            # http://localhost:3000
npm run test:pricing   # verifies the bill engine (24 checks, matches the ₹3,594.87 reference)
```

Storefront: `http://localhost:3000` · Dashboard: `http://localhost:3000/admin` (password `slicematic123`).
It works fully offline — orders save to `data/orders.json` and appear on the dashboard immediately.

## Environment variables (all optional)

Copy `.env.local.example` → `.env.local`. Everything has a sensible default, so set only what you need.

| Variable | Purpose |
|---|---|
| `N8N_WEBHOOK_URL` | New-order WhatsApp alert (customer + staff). Import `n8n/slicematic_whatsapp_workflow.json`. |
| `N8N_DELIVERY_WEBHOOK_URL` | "Out for delivery" alert to the customer. Import `n8n/slicematic_delivery_workflow.json`. |
| `ADMIN_PASSWORD` | Dashboard password (default `slicematic123`). |
| `OPENROUTER_API_KEY` | AI recommendation (omit → friendly fallback). |
| `OPENROUTER_MODEL` | Defaults to `meta-llama/llama-3.1-8b-instruct`. |

## Architecture

```
Customer (/)  ─POST /api/orders─►  lib/store.js (data/orders.json)
                                        │  └─► n8n new-order webhook ─► WhatsApp (customer + staff)
Staff (/admin) ─GET /api/orders──►  live feed
               ─POST /api/orders/status─► status change
                                        └─(Out for delivery)─► n8n delivery webhook ─► WhatsApp (customer)
```

## Order lifecycle

`PLACED` → (Accept) → `ACCEPTED` → (Out for delivery → messages customer) → `OUT_FOR_DELIVERY` → (Mark delivered) → `DELIVERED`

## Swapping the file store for a real database later

Everything DB-related lives in `lib/store.js` (`createOrder`, `listOrders`, `getOrder`,
`getOrdersByPhone`, `updateStatus`). To move to Supabase/Postgres, reimplement those five functions
against your DB — no API route or UI change needed.

## n8n setup

1. Import `n8n/slicematic_whatsapp_workflow.json` (new-order) and `n8n/slicematic_delivery_workflow.json` (delivery).
2. In each, set the WhatsApp credential / token + the owner/staff number.
3. Activate both, copy their **production** webhook URLs into `.env.local`.

> WhatsApp note: a plain-text message only delivers if the recipient messaged your business number in the last 24h; for cold customer messages use an approved template. For the demo, send a "hi" from your test phone first.

## AI feature — recommendation engine (Option A)

After name + phone, `/api/recommend` looks up the customer's past orders (from the file store) and asks
an LLM via OpenRouter for one personalised suggestion. System prompt is documented in `app/api/recommend/route.js`.
