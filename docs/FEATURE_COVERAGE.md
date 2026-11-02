# Coverage and remaining implementation

The README lists working features. This private release is intended for review and merchant setup before public selling. Sample products, images and policies must be replaced or confirmed.

| Area | Current implementation | Remaining |
| --- | --- | --- |
| Payments | COD, externally collected POS payment records | Merchant/gateway selection, card/Apple Pay/BNPL sessions, signed webhooks, reconciliation/refunds |
| Identity | Sites/ChatGPT sign-in, guest checkout | Phone/WhatsApp OTP, Google and Apple provider |
| Messaging | Manual WhatsApp links, captured newsletter/restock requests | Leadvyne/WhatsApp credentials, templates/consent, send jobs, delivery webhooks, cart recovery |
| Shipping | Qatar rate/threshold, slot requests, manual courier/tracking | Provider APIs, labels, real estimates, zones, COD verification and RTO workflows |
| Social/marketing | Static illustrative style gallery, editable copy | Live Instagram, pixels/consent, Merchant feed, Meta sync |
| Inventory | One Doha store, colour/size stock, CSV import and barcodes | Warehouses/transfers, purchasing, cost valuation |
| Accounting | Cashbook, receivables, expenses, balanced manual journals | Automatic journal posting/COGS, trial balance/statements, bank reconciliation, period closing, tax filings |
| Tax/localisation | QAR, English, no assumed regional tax | Merchant tax registration/rules, VAT/GST invoice requirements, multi-currency and translations |

Further product work: typo-tolerant autocomplete/visual search, product-specific multiple size charts and brand sizing, photo-review moderation/display, outfit bundle pricing, structured pre-orders/tailored approval, gift-card redemption, referrals/loyalty/wallet, saved payment instruments, automated exchange reservation/QC restocking/refunds, buy-X-get-Y/flash-sale scheduling, abandoned-cart capture, blog/editorial CMS, editable collection/hero imagery, product schema/sitemap and server-rendered catalogue pages. Stable customer URLs exist; catalogue data currently loads client-side. Virtual try-on is optional future work.

Do not mark an item complete merely because a request note, menu or contact link exists. External features need both account access and integration implementation; they are not activated by entering a phone number.
