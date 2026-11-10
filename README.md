# 4L Fashion · Doha

Modern fashion storefront, POS and store operations for **4L Fashion**, Al Mana Building, Building 70, Zone 26, Street 310, Old Airport Street, Doha, Qatar.

+974 3148 0006 / +974 3148 0005 · info@4LFashion.com.qa · Base currency: QAR.

## Run and validate

Node 22.13+ and pnpm. React + Vinext/Next App Router APIs, Cloudflare Workers, D1 and R2.

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm test
pnpm build
pnpm dev
```

Before local API use, apply the schema after building:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_sad_nitro.sql
```

## Setup

Configure [Google Login](docs/GOOGLE_LOGIN.md), apply the authentication migration, then sign in at `/admin/login`. Only the verified Google account in `OWNER_EMAIL` can provision the initial owner. Authorised administrators can then choose **Initialise store**. Repeat initialisation is blocked. Replace the sample catalogue/photography, confirm policies, shipping, measurements and coupons, then add staff emails.

Owner/admin/manager accounts can manage the store. Viewers have no admin access. API identity comes exclusively from opaque Google session cookies backed by D1. Incoming ChatGPT/user identity headers do not grant access. Google customers are separate from staff roles.

The tracked `.openai/hosting.json` retains the review deployment identity. Secrets belong in runtime settings, never source. GitHub `main` contains source; the deployment host has a separately synchronised source repository.

## Working first release

- Editorial desktop storefront and mobile fashion app layout, search, swipeable collection rail, quick-add size sheets, fixed bottom navigation and product purchase bar.
- Categories/occasion edits, filters, sort/grid, PDP/zoom, optional video/gallery/colour-image URLs, colour/size variants, default size chart, care/fit notes and related pieces.
- Wishlist/cart, server-priced COD checkout, percentage coupons, shipping threshold, gift-wrap/message, custom-measurement request notes, confirmation and order tracking.
- Google sign-in with D1 sessions, order history, address/preferences, return/exchange requests and newsletter/restock request capture.
- D1-backed products, R2 photo upload, CSV draft import/export, stock adjustments, low-stock indicators, orders, customer history, return/QC queue, editable homepage/policies/size chart, reports, roles and activity log.
- POS shares stock with online orders. Server prices, transactional negative-stock protection, stable request IDs, duplicate-safe retries and cancellation restocking.
- Barcode lookup and Code 39 labels, counter payment recording, printable receipts/order details, manual courier references and user-initiated WhatsApp links.
- Accounting cashbook for sales, collected payments, receivables and expenses, plus balanced immutable manual journals. Journals are separate from the derived order cashbook; they are not automatically posted from each order.
- AI fit and styling on Cloudflare Workers AI: fit memory learned from returns with per-size notes, "Fits like my favourite" photo size matching, and an occasion planner that plans a look for each event. See [AI features](docs/AI_FEATURES.md).
- Installable PWA, precached production JS/CSS, IndexedDB snapshots, offline POS/stock/expenses/journals, ordered durable outbox, conflict visibility and reconnect retry.

## Release limits

This is a working first release, **not the entire advanced feature list completed**. See [feature coverage](docs/FEATURE_COVERAGE.md). Google sign-in is implemented and requires the store’s Google OAuth credentials and runtime settings. Card/BNPL gateways, OTP, automated messaging, courier APIs and marketing integrations need provider access plus integration work. Checkout currently uses COD, QAR and one Doha warehouse. No UAE/India tax rule is assumed for Qatar.

Accounting is an operational cashbook plus manual journal, not a complete statutory accounting suite. Automated tax invoices, bank reconciliation, automatic cost valuation and tax filings remain unimplemented.

## Offline and validation

See [offline operations](docs/OFFLINE.md). Prepare the device online by opening the authorised dashboard, then install the PWA. First setup, login, external payments and uncached downloads require connectivity. Reopen the app or choose **Sync now** after reconnecting. Keep device storage until all entries are synced.

`pnpm test` checks commerce invariants with real route code against isolated SQLite/identity adapters, and operational persistence with IndexedDB. Tests cover permissions, server prices/coupons, idempotency, atomic stock rollback, concurrent depletion, cancellation, cross-origin protection, Google signature/audience/nonce verification, PKCE/state/replay protection, owner/customer separation, sessions/logout, durable queues, failed-sync retention, ordered retries and online authorisation failures.

## Automatic deployment from GitHub

Pushes to `main` run the [Cloudflare deployment workflow](.github/workflows/deploy-cloudflare.yml). Add the two required GitHub repository secrets once; see [auto-deploy setup](docs/AUTO_DEPLOY.md). The workflow checks types/tests, builds the PWA, creates missing current-schema D1 tables and deploys the Worker.

## Team administration

In **Staff & permissions**, owners and administrators can add an additional admin using the Google-account dropdown or a verified Google email. The role dropdown supports Administrator, Store manager and No admin access. Existing roles can be changed directly in the team list. Managers cannot grant team access, duplicate email assignments are rejected, and the owner entry is protected. Staff sign in through Google; adding a member does not send an invitation.
