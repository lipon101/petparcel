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
| Payments | 2Checkout (Verifone) hosted checkout — the single card gateway |
| Hosting | Vercel (static client + serverless API) or any Node host |

---

## 1b. Design system

The storefront's **structure and rhythm** follow the reference storefront (rupanjali.com):
a three-row header, a soft ground, product cards with a square image well, a small tracked
category label, a rose price line and a round add-to-cart button. The **palette and type**
are PetParcel's own.

**Colour.** The whole site resolves through the tokens in `client/src/index.css` — nothing
is hardcoded per-component, so re-pointing the tokens re-skins every surface at once.

| Token | Value | Role |
|---|---|---|
| `--pink` | `#EB3594` | Brand pink — focus rings, hairlines, decorative fills (non-text) |
| `--pink-dark` | `#D24862` | The deeper accent the brand pairs with it — emphasis, highlights |
| `--primary` / `--orange` | `#D0337F` | The rose that carries text and buttons (**4.71:1** on white — AA) |
| `--navy` | `#B03A6E` | Structural rose — dark bands, category pill, icon wells (**5.68:1**) |
| `--navy-deep` | `#7E2350` | Wordmark and headings that need the most depth (**8.70:1**) |
| `--blush` | `#F8E9E7` | Warm blush band (section grounds, image wells) |
| `--cream` | `#FAF3F1` | Soft card/muted surface |
| `--footer-bg` | `#F9ECEA` | Footer band |
| `--ink` | `#1B1B1B` | Body text |
| `--line` | `#EFE3E0` | Hairlines and borders |

**Accessibility.** White text is only placed on tokens that clear 4.5:1 (`--primary`,
`--navy`, `--navy-deep`). The bright `#EB3594` is deliberately reserved for non-text use,
because white on it measures ~3.4:1 — it is the identity colour, not a text background.

**Typography.**

| Role | Family |
|---|---|
| Display / headings / wordmark | `"Libre Baskerville", Georgia, "Times New Roman", serif` |
| Body / UI | `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` |

Libre Baskerville is loaded from Google Fonts with `display=swap` and is available in only
400 and 700. Headings are therefore set at **400** (a synthesised 500/600 in a serif looks
broken) and the wordmark uses 700. Because the face sets noticeably wider than a sans, every
heading size is clamped and re-tracked down for it (`h1` `clamp(1.6rem, 4.2vw, 2.9rem)`,
`.section-title` `clamp(22px, 2.7vw, 30px)`), which is what keeps long headings inside their
column down to 390px.

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
- Products: create/edit/delete, live/hidden and featured toggles, **drag-and-drop image uploads** (with reorder, delete and previews) alongside paste-by-URL, tags
- Variants: per-variant price and stock, auto-generated SKU
- Orders: filter by status, update status (with activity log), payment status, carrier + tracking number
- Customers: derived list with order count and lifetime spend
- Inventory: inline stock editing with low-stock flags
- Settings: brand copy, shipping/tax rates, returns window, contact details, payment method, and email sender name / from-address / reply-to

**Transactional email** (Resend)
- **Order confirmation** — sent automatically when an order is placed: itemised lines with quantities and prices, subtotal / shipping / total, the shipping address, and a link to the tracking page
- **Shipping notification** — sent automatically when an admin saves a carrier + tracking number on an order that has not shipped yet: carrier, tracking number, a carrier deep link and the order number
- Branded, mobile-friendly HTML with a plain-text fallback
- Every attempt is recorded, and the **admin order view shows `sent` / `skipped` / `failed`** with the reason — `skipped` is the pre-setup state when `RESEND_API_KEY` is absent
- Either email can be re-sent from the admin order view

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
| `TWOCHECKOUT_SELLER_ID` | ✅ to go live | Your Verifone seller ID |
| `TWOCHECKOUT_SECRET_KEY` | ✅ to go live | From your 2Checkout account |
| `TWOCHECKOUT_MODE` | – | `test` (default) or `live` |
| `RESEND_API_KEY` | – | Resend API key for transactional email. **Without it the store still works** — sends are recorded as `skipped` |

Payment keys are **secrets** — they live in environment variables only, never in the
database and never in the admin UI. The admin Settings page only shows the active
payment method.

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

Card acceptance runs through **2Checkout (Verifone)** behind `server/services/payments.ts`,
and it is the **only** payment method — checkout offers a card payment and nothing else.

**The owner's remaining steps are exactly two:** apply for a 2Checkout (Verifone) merchant
account, then paste `TWOCHECKOUT_SELLER_ID` and `TWOCHECKOUT_SECRET_KEY` into the Vercel
environment variables. No code change is needed.

**Before the keys are added** the store still runs end-to-end: orders are recorded as
*unpaid* and can be settled offline by an admin marking them paid. That is a graceful
fallback of the gateway, not a second payment method — there is no invoice or
bank-transfer option anywhere in the store.

How confirmation works: after the buyer returns from the hosted page, the server **pulls**
the order status from 2Checkout's API (`verifyPayment`) and marks the order paid. This
works without exposing a webhook URL, and a card order is only confirmed when the gateway
itself reports it paid.

See **[docs/payment-options-bangladesh.md](docs/payment-options-bangladesh.md)** for the full
comparison of options for a Bangladesh-based merchant and step-by-step setup.

---

## 5b. Transactional email (Resend)

Order emails go out through **[Resend](https://resend.com)** behind
`server/services/email.ts`. Two fire automatically, on the real business events:

| Email | Fires when | Contains |
|---|---|---|
| **Order confirmation** | an order is placed (`checkout.place`) | itemised lines with qty + prices, subtotal / shipping / total, shipping address, a link to the tracking page |
| **Shipping notification** | an admin saves a carrier + tracking number on an order that was not already shipped (`admin.setTracking`) | carrier, tracking number, a carrier deep link, the order number |

Both are branded HTML (navy + warm-orange, single column, mobile-friendly) with a plain-text
alternative, and both escape customer-supplied text before it reaches the markup.

### Turning it on — step by step

1. **Create a Resend account** at [resend.com](https://resend.com) (the free tier sends
   3,000 emails/month, 100/day — ample for a new store).
2. **Verify a sending domain.** *Domains → Add Domain*, enter `petparcel.store`, and add the
   `SPF`/`DKIM` DNS records Resend shows you. Verification usually completes in minutes.
   A domain **must** be verified before Resend will send from it.
3. **Create an API key.** *API Keys → Create API Key*, permission *Sending access*. Copy it —
   it is shown once.
4. **Set the environment variable** `RESEND_API_KEY` (Vercel → *Settings → Environment
   Variables*, or `.env` locally). Redeploy/restart so it is picked up.
5. **Set the from-address** in the store: **admin → Settings → Email (Resend)** — sender
   name, **From address** (must be on the domain you verified, e.g. `orders@petparcel.store`)
   and a reply-to. Save.

That is the whole setup — no code change and no redeploy for steps 5.

### What happens before you add the key

**Nothing crashes and nothing is misreported.** With no `RESEND_API_KEY`, every attempt is
recorded in the `email_log` table as **`skipped`**, the checkout response carries that status
back to the confirmation page, and the admin order view shows it. The customer sees
"email isn't switched on yet — keep your order number, or track it at `/track`" rather than a
false "we've emailed you". Once the key is present, sends go out and the same panel shows
`sent` (with the Resend message id) or `failed` (with Resend's error text).

Either email can be **re-sent** from the admin order view — useful after you add the key to
catch up on orders placed while it was missing.

---

## 6. Project structure

```
app/
├── client/
│   ├── index.html              # SEO head: canonical, OG, Twitter, JSON-LD
│   ├── public/                 # hero.png, favicon, robots.txt, sitemap.xml, products/
│   └── src/
│       ├── components/site/    # Layout (header/footer), ProductCard, ImageUploader, Bits
│       ├── lib/                # cart + SEO hooks, view types
│       ├── pages/              # Home, Shop, ProductDetail, Cart, Checkout, Track,
│       │                       # Account, Admin, Content, Login, Register
│       └── _core/              # platform primitives (auth, trpc) — do not edit
├── server/
│   ├── db.ts                   # all data access (owner-scoped)
│   ├── routers.ts              # tRPC API surface
│   ├── seed.ts                 # demo data seeder
│   ├── store-settings.ts       # typed settings loader
│   └── services/
│       ├── payments.ts         # pluggable payment providers
│       └── email.ts            # Resend email: 2 templates + email_log
├── drizzle/schema.ts           # 13 tables + migrations
├── scripts/                    # seed, sitemap, admin:create, reset-db
└── vercel.json
```

---

## 7. Notes & known boundaries

- **Transactional email is off until you add a key.** With no `RESEND_API_KEY` the store
  never crashes and never silently pretends: each attempt is recorded in `email_log` as
  `skipped` and shown on the admin order view. Add the key and set a verified from-address
  in Settings → Email to switch sending on (section 5b).
- **Uploaded images need storage configured.** The admin uploader uses the platform's file
  primitives, so a deployment without those env vars reports "storage isn't configured yet"
  rather than failing silently. Pasting image URLs always works as a fallback.
- **Payment confirmation is pull-based.** A gateway webhook receiver would need a route
  outside the tRPC mount; the pull model avoids that and is sufficient for hosted checkouts.
- **Order identifiers use a random suffix** (e.g. `PP-M9YRQAPT`), so they are not guessable.
  Guest tracking additionally requires the email used at checkout.
- **Admin role** is granted only by `pnpm admin:create` — it is never self-assignable.
- Styling tokens live in `client/src/index.css`; the palette (section 1b) and the heading
  type scale are each a single-block edit there.

---

## 8. Verification

The build is checked by executable signals, not by eye. Latest run:

| Signal | Result |
|---|---|
| Dev-server logs | clean (single instance) |
| `pnpm test` | **156 passed**, 0 failed |
| `pnpm typecheck` | 0 errors |
| Route screenshots | all 22 routes captured and reviewed (`/` … `/contact`) |
| Computed styles | `h1` and `.brand-name` resolve to `"Libre Baskerville"` with `document.fonts.status === "loaded"` (a real load, not the fallback) |
| Palette applied | `--pink` `#eb3594`, `--primary` `#d0337f`, `--navy-deep` `#7e2350`, `--blush` `#f8e9e7`; button `rgb(208,51,127)`, footer `rgb(249,236,234)` |
| Overflow | `scrollWidth <= innerWidth` at desktop and at a forced 375px column; no heading or card overflow |
| Product imagery | 20/20 catalog images load on `/shop`, 0 broken |
| Old palette sweep | zero legacy hex values, `Fraunces` or `Outfit` references remain in `client/`, `server/` or `shared/` |

---

*PetParcel is a demo storefront with realistic placeholder catalog data. Replace the
products, imagery and policy copy with your own before trading.*
