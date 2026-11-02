# Offline operations

## Prepare each register

Open the HTTPS site online, sign in, initialise if needed and open `/admin`. Visit POS, Inventory and Accounting to prepare the operational snapshot. Allow the service worker to finish installing. Production builds generate `/offline-assets.json`; installation precaches JS/CSS and the navigation shell. Successfully viewed images are cached as they load.

Install using Chrome/Edge's install option, or Safari **Share → Add to Home Screen**. Verify a small sale reaches Orders on the intended register before depending on offline mode.

| Operation | Offline behaviour |
| --- | --- |
| POS sale | Uses device stock, reduces local quantities, creates pending receipt, queues sale. |
| Barcode search | Uses cached variant barcodes. Hardware scanners act as keyboards. |
| Stock adjustment | Validates whole-number delta and non-negative local stock; queues movement. |
| Expense / journal | Saves on device and queues with a stable record ID. Journals must balance. |
| Cashbook / reports | Uses cached data plus pending device changes. |
| Receipt / label print | Depends on operating-system and printer offline support. |
| Customer web checkout | Needs online server validation. |
| Card capture / OTP / courier / messages | Needs provider connectivity. POS records payment collected separately. |
| Product / staff / policies / returns | Online management only. |

## Reconcile

The IndexedDB queue survives reloads and app closing on the same browser profile. When connected, reopen the app or choose **Sync now**. The server revalidates permissions and stock. Stable IDs prevent duplicate sales and stock movements after retry. Acknowledged operations leave the queue; the authoritative snapshot refreshes after the whole queue succeeds.

Failures remain visible with a reason; subsequent operations wait in order. Resolve the underlying stock/access/validation issue online and retry. Offline devices can conflict with another register's sales. Pending sales are never silently discarded or permitted to make server inventory negative. A pending receipt is not confirmed server fulfilment.

Do not clear browser data, use incognito, uninstall the profile or switch devices while changes remain unsynced. Unsynced entries live on that device, not in a cloud backup. Keep operational devices access-controlled because their authorised records are intentionally available offline.

Sync runs in the open/reopened application; closed-app background sync is not guaranteed. First setup/authentication/downloads need connectivity. The HTTP development preview cannot validate HTTPS-only installation; production asset generation, IndexedDB flows and server retry invariants are checked separately.

Google login requires connectivity. Sign out clears the device's private snapshots and is blocked until pending operations are synced. Signing in as another staff member does not authorise replaying the original staff member's queued operations.
