# AI fit and styling features (Cloudflare Workers AI)

Three shopper features use the Worker's `AI` binding (Cloudflare Workers AI). The models handle language and vision. Rules in `lib/fit-ai.ts` make the final decision, so every answer is checked against live stock, size charts and budget. If Workers AI is unavailable, the features fall back to those rules.

| Feature | Where | Model |
|---|---|---|
| **Fit memory from returns** | Account → order → *Request a return or size exchange*; notes on every product page; *Your fit memory* in Account | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| **Fits like my favourite** | Product page → *Fits like my favourite ✦* | `@cf/meta/llama-4-scout-17b-16e-instruct` (vision) |
| **Occasion planner** | `/pages/occasion-planner`, homepage banner, main navigation | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |

## How each feature works

**Fit memory.** A signed-in customer picks the item and describes the fit, for example "too tight in the shoulders". The model extracts fit problems as `{area, direction}`. Anything outside the known areas and directions is dropped. Each problem is saved with the returned size and that product's cut, in a `fitProfile` record owned by the customer. On a product page, `fitAdvice()` turns this history into a note for each size, such as "In your fit, size M will likely feel snug at the chest", plus a suggested size. The threshold moves one size up or down when this product's cut is closer or looser than the returned piece. Customers can clear their fit memory from their account.

**Fits like my favourite.** The shopper photographs a garment laid flat, next to an A4 sheet, a bank card or a phone. The photo is shrunk in the browser to 1024 px, sent once and never stored. The vision model estimates chest, waist, hip and length. These numbers stay editable, and the shopper can also enter measurements without a photo. `matchFavourite()` subtracts the ease for the garment's cut to work out body measurements. It then finds the closest in-stock size on each product's size chart and ranks the pieces by how close the cut and garment type are.

**Occasion planner.** The shopper types a short brief, such as "Cousin's wedding in Kochi, December, outdoor, 3 events, budget QAR 1000". One model call reads the events, weather, colour etiquette and budget, and picks one in-stock product per event from a shortlist. `planLooks()` checks each pick: it must exist, be in stock, not repeat, not use an avoided colour and fit the budget. Any pick that fails is replaced with the best-scoring alternative. If the total is over budget, the planner swaps in cheaper pieces.

## Setup

- The binding is set in `vite.config.ts` (`ai: { binding: "AI" }`) and included in `dist/server/wrangler.json`. The existing deploy workflow ships it.
- The `CLOUDFLARE_API_TOKEN` used for deployment must include the **Workers AI** permission (Account → Workers AI → Read). Without it, the deploy fails.
- Usage is billed to the Cloudflare account under Workers AI pricing, which includes a free daily allowance. The AI endpoints accept 8 requests per minute per IP address.
- With `pnpm start`/`pnpm dev`, Wrangler sends AI calls to your Cloudflare account. If you are not logged in, the features use the rule-based fallbacks.

## API

- `POST /api/store` `{action:"return", data:{orderId, variant, type, reason}}` saves the request and returns `learned` when fit problems were found.
- `GET /api/store?action=fitProfile` / `POST {action:"fitProfileReset"}` read or clear the signed-in customer's fit memory.
- `POST {action:"fitPhoto", image:"data:image/jpeg;base64,…", reference:"a4"|"card"|"phone"|"none"}` returns `{measure, confidence, note}`.
- `POST {action:"occasionPlan", brief}` returns `{brief, looks, total, source:"ai"|"rules"}`.

Tests: `node scripts/test-ai.mjs` (included in `pnpm test`) uses a fake binding and makes no network calls.
