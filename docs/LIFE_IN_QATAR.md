# Life in Qatar (for expat families)

The **Life in Qatar** page at `/pages/qatar` is linked from the main menu and a homepage banner. It has five tabs, and you can link to a tab directly with `#month`, `#dress`, `#festivals`, `#welcome` or `#groups`.

| Tab | What shoppers get |
|---|---|
| **This month** | Doha's average temperatures for the month, tips for going from outdoor heat to office AC (18–20°C), breathable fabrics, colours that hide sweat, 4 in-stock pieces, and upcoming festivals and community events. |
| **Dress-sense guide** | Ask "What can I wear to a mall in Lusail / an office in West Bay / a majlis / the Corniche on National Day?" and get local norms by place plus modest-friendly pieces. Written for new arrivals and family visiting on visit visas. |
| **Festivals** | Onam, Vishu, Eid al-Fitr, Eid al-Adha, Diwali, Christmas and Pongal: what to wear, Doha community events listed by the store, and ideas for the family video call. |
| **New to Qatar** | Family members with optional age and size → a starter wardrobe (office basics, school-event wear, a modest mall outfit) in stock in each person's size and within budget, plus dress norms and the store's welcome offer. |
| **Group orders** | An organiser (signed in with Google) describes a theme, for example "kasavu with green borders". The AI suggests matching pieces, and the organiser creates a group and shares a link (`/pages/group/CODE`). Members add their name, WhatsApp number, piece, colour and size without an account. A discount tier applies automatically, and the organiser sees the size breakdown, removes entries, closes the list and sends the order to 4L. |

## How the AI is used (Cloudflare Workers AI)

Facts are kept in `lib/qatar.ts`: Doha's monthly climate, dress norms by place, festival dress notes and video-call ideas, discount tiers, and product scoring. `lib/qatar-ai.ts` sends these facts plus live stock to Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`). The model writes the personal advice and picks products, with these safeguards:

- The model is told to use only the norms provided and never to invent dates, events, prices or rules.
- Every product pick is checked: it must exist, be in stock (and in the member's size for welcome kits) and not repeat. Anything else is replaced by the rule-based pick.
- The month guide and festival kits are the same for everyone, so they are cached for 12 hours. Cached picks are re-checked against live stock on every request.
- If Workers AI is unavailable, every tab still works from the rules.
- The AI endpoints accept 8 requests per minute per IP. Group joins accept 20 per minute per IP.

## Store admin: Store Studio → Life in Qatar

- **Community group orders**: every group with organiser contact, piece count, estimated total with discount, size breakdown and member list. Set the status (open → closed → submitted → confirmed → ready → completed / cancelled). After confirming stock and pricing with the organiser, create the order(s) in POS or Orders. Group orders do not reserve stock automatically.
- **Doha community events**: add real events (association, ICC/ICBF, church, temple, mosque, school) with date, venue, organiser, an https link and an optional festival. Past events are hidden automatically.
- **Festival dates**: Eid, Onam and Diwali move every year, so set each date once it is announced. Until then the page shows the usual months. Christmas (25 Dec), Vishu (14 Apr) and Pongal (14 Jan) use their usual dates.
- **Welcome offer**: a coupon code (create it under Discounts first) and the offer text shown to new arrivals.
- **Group discount tiers**: up to 3 tiers of pieces → % off. The defaults are 10+ pieces 10%, 20+ 15% and 40+ 20%.

## Privacy

On the shared group page, other members see only first names and sizes. Phone numbers are visible only to the organiser and store staff.

Tests: `node scripts/test-qatar.mjs` (included in `pnpm test`).
