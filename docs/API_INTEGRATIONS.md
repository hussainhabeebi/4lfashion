# Platform integrations: auto-sync orders and items (Leadvyne and others)

Connect Leadvyne, a CRM, an ERP, an accounting tool or an automation service (Zapier, Make, n8n)
so orders, items and stock sync automatically. Set it up in **Admin → Integrations → Platform connections**.
Only the owner or an administrator can create, change or disconnect a connection.

Each connection has:

| | What it does |
| --- | --- |
| **API key** (`4lf_…`) | The platform uses it to **pull** orders, products and stock from the read-only REST API. Shown once; stored only as a hash. Replace it any time (the old key stops working at once). |
| **Webhook URL** (optional) | The store **pushes** a signed JSON event to this URL the moment an order or product changes. |
| **Signing secret** (`whsec_…`) | Lets the platform check that a webhook really came from the store. |
| **Extra header** (optional) | Sent with every webhook, e.g. `Authorization: Bearer <Leadvyne key>` if the platform gives you its own key for incoming data. Write-only: never shown again after saving. |
| **Access & events** | Choose what the key can read (orders, products & stock) and which events are pushed. |

Connections can be paused (key refused, nothing pushed), edited, tested and disconnected.
Each connection shows its last API call and its last 10 webhook deliveries.

## Connecting Leadvyne

1. Admin → Integrations → **Connect Leadvyne**. Leave everything ticked.
2. If Leadvyne gives you a webhook / "incoming data" URL, paste it as the **Webhook URL**. If it also gives you a key
   for that URL, put the header it expects (e.g. `Authorization` with `Bearer <key>`, or `X-API-Key`) in **Extra header**.
3. **Create connection & API key**, then copy the **Base URL**, **API key** and **signing secret** into Leadvyne’s
   integration settings (a "REST API" / "custom API" / "webhook" source).
4. Choose **Test** to send a `ping` event. A green "Delivered" row means Leadvyne received it.

If Leadvyne only polls, leave the webhook empty: it calls `GET /api/v1/orders?updated_since=…` with the key.

## REST API (pull)

Base URL: `https://<your store>/api/v1` · Auth: `Authorization: Bearer 4lf_…` (or `X-API-Key: 4lf_…`) · read-only (`GET`).
Money is QAR as decimal numbers (`249.5`). Limit: 240 requests per minute per key.

| Endpoint | Returns |
| --- | --- |
| `GET /api/v1` | Endpoint list (no key needed). |
| `GET /api/v1/ping` | Connection name and scopes, to check the key. |
| `GET /api/v1/orders` | Orders, oldest change first. Query: `updated_since`, `created_since` (ISO time), `status`, `source` (`Online`/`POS`), `include_test=true`, `limit` (1–100, default 50), `page`. |
| `GET /api/v1/orders/{id}` | One order. |
| `GET /api/v1/products` | Products with variants and stock. Query: `published=true|false`, `limit`, `page`. |
| `GET /api/v1/products/{id}` | One product. |
| `GET /api/v1/inventory` | Stock per size/colour variant. Query: `limit`, `page`. |

Lists return `{data, page, limit, total, has_more, next_page}`. Errors return `{error: {code, message}}`
with 401 (bad key), 403 (paused or missing scope), 404, 405 or 429.

**Incremental sync:** remember the largest `updated_at` you have processed and ask for
`/orders?updated_since=<that value>` next time, following `next_page` until `has_more` is false.
This also catches up anything a webhook missed.

Order fields: `id`, `status`, `source`, `created_at`, `updated_at`, `customer {name, email, phone}`,
`shipping_address`, `delivery_slot`, `payment {method, paid}`, `currency`, `subtotal`, `discount`, `shipping`,
`total`, `refund_due`, `refunded`, `fulfilment {carrier, tracking}`, `items[] {variant_id, product_id, sku, name,
size, colour, quantity, cancelled_quantity, active_quantity, unit_price, line_total, image}` and the customer-visible
`timeline`. Staff-only notes are never included. Test orders are excluded unless `include_test=true`.

## Webhooks (push)

`POST` to your URL with JSON `{id, event, created_at, connection, data}` and headers:

- `X-4L-Event`: event name · `X-4L-Delivery`: unique delivery id (use it to ignore duplicates)
- `X-4L-Timestamp`: Unix seconds · `X-4L-Signature`: `sha256=` + hex HMAC-SHA256 of `timestamp + "." + raw body` with the signing secret

| Event | `data` |
| --- | --- |
| `order.created` | Order (online checkout or POS sale) |
| `order.updated` | Order after a status, payment, tracking, refund or test-flag change |
| `order.cancelled` | Order after a full or partial cancellation |
| `order.deleted` | `{id}` of a deleted test order |
| `product.created` / `product.updated` | Product with variants and stock |
| `product.deleted` | `{id}` |
| `inventory.updated` | `{reason, variants[] {variant_id, product_id, size, colour, stock}}` after a sale, restock or manual adjustment |
| `ping` | Test event from the **Test** button |

Answer with any 2xx within 8 seconds. Network errors, 429 and 5xx are retried once; every attempt is listed
under the connection. The same order may arrive more than once (for example a retried checkout), so treat the
order `id` as the key. Webhook URLs must be public `https://` addresses.

Verify a signature (Node):

```js
import crypto from 'node:crypto';
const expected = 'sha256=' + crypto.createHmac('sha256', SIGNING_SECRET).update(req.headers['x-4l-timestamp'] + '.' + rawBody).digest('hex');
const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(req.headers['x-4l-signature']));
```

## Storage

Connections and the delivery log are stored in the existing `records` table (`integration`, `webhookDelivery`,
`apiRate`), so no database migration is needed.
