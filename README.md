# PetParcel 🐾 — Full-Stack Pet Supplies Store

A production-ready, fully dynamic e-commerce storefront for **PetParcel** (`www.petparcel.store`),
built from scratch for the **US market** — React + tRPC + Postgres. No Shopify, no hardcoded catalog.

> Everything on the storefront — products, variants, stock, prices, orders, customers,
> addresses, tracking, reviews, shipping/tax rates, brand copy and contact details — is
> stored in the database and editable from the admin panel.

---

## 1. Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + Tailwind CSS v4 + wouter routing |
| API | tRPC (type-safe end-to-end) on a Hono server |
| Database | PostgreSQL via Drizzle ORM (migrations committed) |
| Auth | Email + password, session cookie (bcrypt hashes) |
| Payments | Pluggable provider abstraction — 2Checkout (Verifone) or manual/offline |
| Hosting | Vercel (static client + serverless API) or any Node host |

---

## 2. Features

**Storefront**
- Home with hero, trust badges, featured products, benefits, reviews and FAQ
- Shop with category filtering, search and sorting
- Product pages with image gallery, variants (size/color), stock awareness, reviews, related products
- Cart (localStorage-backed) with quantity edits and a running total
- Checkout: contact, shipping address, billing (or "same as shipping"), payment method, order notes
- Order confirmation page with live timeline, plus a public **order tracking** page (order number + email)
- US-English copy throughout, USD pricing, US shipping/returns messaging

**Customer accounts**
- Signup / login / sign out
- Profile, order history, order detail
- Saved address book with default shipping/billing

**Admin panel** (`/admin`, admin role only)
- Dashboard: paid revenue, open orders, customers, reviews, low-stock list, best sellers, recent orders
- Products: create/edit/delete, live/hidden and featured toggles, image URLs, tags
- Variants: per-variant price and stock, auto-generated SKU
- Orders: filter by status, update status (with activity log), payment status, carrier + tracking number
- Customers: derived list with order count and lifetime spend
- Inventory: inline stock editing with low-stock flags
- Settings: brand copy, shipping/tax rates, returns window, contact details, active payment provider

**SEO (US-targeted)**
- Per-route `<title>`, meta description, canonical, Open Graph and Twitter cards
- JSON-LD structured data: Organization, WebSite, OnlineStore, Product, BreadcrumbList, FAQPage, ItemList
- `robots.txt` (blocks `/account`, `/admin`, `/cart`, `/checkout`, `/order/*`)
- `sitemap.xml` generated from the live catalog (`pnpm sitemap`)

---

## 3. Local development

```bash
pnpm install
cp .env.example .env          # then fill in DATABASE_URL + JWT_SECRET
pnpm db:reset                 # (optional) drop all tables — dev only
pnpm db:generate && pnpm db:migrate   # create + apply the schema
pnpm seed                     # load demo catalog, reviews and sample orders
pnpm dev                      # client on :3000, API on :3001
```

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string |
| `JWT_SECRET` | ✅ | Long random string for session signing |
| `TWOCHECKOUT_SELLER_ID` | For 2Checkout | Your Verifone seller ID |
| `TWOCHECKOUT_SECRET_KEY` | For 2Checkout | From your 2Checkout account |
| `TWOCHECKOUT_MODE` | – | `test` (default) or `live` |

Payment keys are **secrets** — they live in environment variables only, never in the
database and never in the admin UI. The admin Settings page only selects which provider
is *active*.

### Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Run client + API in watch mode |
| `pnpm build` | Type-check and produce the production bundle |
| `pnpm test` | Run the vitest suite |
| `pnpm typecheck` | TypeScript check |
| `pnpm db:generate` / `db:migrate` | Create / apply Drizzle migrations |
| `pnpm db:reset` | **Destructive** — drop every table (dev only) |
| `pnpm seed` | Idempotent demo-data seeder |
| `pnpm sitemap` | Regenerate `client/public/sitemap.xml` from the catalog |
| `pnpm admin:create` | Promote or create an admin (see below) |

### Creating the store owner (admin)

There is deliberately no default admin password in the repo.

```bash
ADMIN_EMAIL="you@yourstore.com" ADMIN_PASSWORD='a-strong-password' pnpm admin:create
```

Then sign in at `/login`; the admin panel is at `/admin`.

---

## 4. Deploying to Vercel

The app is a static client + a serverless API, so it deploys cleanly to Vercel's free tier.
You need a hosted Postgres database (Vercel's own Postgres, **Neon** or **Supabase** all work).

1. **Create a database** (e.g. Neon) and copy its pooled connection string.
2. **Push the repo to GitHub**, then in Vercel → *Add New Project* → import the repo.
3. **Set environment variables** in Vercel → *Settings → Environment Variables*:
   `DATABASE_URL`, `JWT_SECRET`, and any payment keys you have.
4. **Build settings** (also committed in `vercel.json`):
   - Install Command: `pnpm install --frozen-lockfile`
   - Build Command: `pnpm build`
   - `vercel.json` rewrites every path to `index.html` so client routes deep-link correctly
     and sets long-lived cache headers for `/products/*` and `/hero.png`.
5. **Run migrations + seed against the production database** once, from your machine:
   ```bash
   DATABASE_URL="<prod-url>" pnpm db:migrate
   DATABASE_URL="<prod-url>" pnpm seed        # optional — demo content
   DATABASE_URL="<prod-url>" ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm admin:create
   ```
6. **Deploy** — Vercel builds and serves it. Add `www.petparcel.store` under
   *Settings → Domains* and point your DNS (an `A`/`CNAME` record) at Vercel.
7. **Regenerate the sitemap** after you change the catalog:
   `DATABASE_URL="<prod-url>" pnpm sitemap`, then commit and redeploy.
8. In **Google Search Console**, verify the domain and submit
   `https://www.petparcel.store/sitemap.xml`.

> The `https://www.petparcel.store` URLs baked into `index.html` (canonical, Open Graph)
> and `robots.txt` are correct once the custom domain is attached. If you launch on a
> different domain first, update those values and the `STORE_URL` constant in `shared/store.ts`.

---

## 5. Payments

Card acceptance is **pluggable** behind `server/services/payments.ts`. Two providers ship:

- **`manual`** (default) — the order is recorded as *unpaid* and you settle by invoice.
  This lets the store run end-to-end before any gateway credentials exist.
- **`2checkout`** (Verifone) — hosted checkout redirect; the single supported card
  gateway, recommended for a Bangladesh-based merchant selling physical goods to US
  cardholders.

**2Checkout is the only card gateway.** The owner's remaining steps are exactly two:
apply for a 2Checkout (Verifone) merchant account, then paste `TWOCHECKOUT_SELLER_ID`
and `TWOCHECKOUT_SECRET_KEY` into the Vercel environment variables and set
`payment_provider` to `2checkout` in admin → Settings → Payments. Until then the store
runs in `manual` mode and takes orders end-to-end.

How confirmation works: after the buyer returns from the hosted page, the server **pulls**
the order status from the provider's API (`verifyPayment`) and marks the order paid. This
works without exposing a webhook URL. A provider call is only made when a provider is
configured; with `manual` the flow is purely offline.

See **[docs/payment-options-bangladesh.md](docs/payment-options-bangladesh.md)** for the full
comparison of options for a Bangladesh-based merchant and step-by-step setup.

---

## 6. Project structure

```
app/
├── client/
│   ├── index.html              # SEO head: canonical, OG, Twitter, JSON-LD
│   ├── public/                 # hero.png, favicon, robots.txt, sitemap.xml, products/
│   └── src/
│       ├── components/site/    # Layout (header/footer), ProductCard, shared Bits
│       ├── lib/                # cart + SEO hooks, view types
│       ├── pages/              # Home, Shop, ProductDetail, Cart, Checkout, Track,
│       │                       # Account, Admin, Content, Login, Register
│       └── _core/              # platform primitives (auth, trpc) — do not edit
├── server/
│   ├── db.ts                   # all data access (owner-scoped)
│   ├── routers.ts              # tRPC API surface
│   ├── seed.ts                 # demo data seeder
│   ├── store-settings.ts       # typed settings loader
│   └── services/payments.ts    # pluggable payment providers
├── drizzle/schema.ts           # 12 tables + migrations
├── scripts/                    # seed, sitemap, admin:create, reset-db
└── vercel.json
```

---

## 7. Notes & known boundaries

- **Transactional email is not sent.** Order confirmation is shown on screen and is
  re-fetchable any time at `/track` with the order number + email. If you want email,
  wire a provider such as Resend into `server/services/`.
- **Payment confirmation is pull-based.** A gateway webhook receiver would need a route
  outside the tRPC mount; the pull model avoids that and is sufficient for hosted checkouts.
- **Order identifiers use a random suffix** (e.g. `PP-M9YRQAPT`), so they are not guessable.
  Guest tracking additionally requires the email used at checkout.
- **Admin role** is granted only by `pnpm admin:create` — it is never self-assignable.
- Styling tokens live in `client/src/index.css`; changing the brand palette is a
  single-block edit there.

---

*PetParcel is a demo storefront with realistic placeholder catalog data. Replace the
products, imagery and policy copy with your own before trading.*
