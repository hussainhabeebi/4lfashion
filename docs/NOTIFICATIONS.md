# Order notifications (email and WhatsApp)

The store sends order updates to customers (and new-order / cancellation alerts to the store)
automatically once the provider keys below are set. Until then nothing is sent automatically;
each order page in the admin has **Open in WhatsApp** and **Open in email** buttons with the
message already written.

Choose which messages go out on which channel in **Admin → Settings → Notifications**.

## Where to add the keys

Cloudflare dashboard → Workers & Pages → the 4L Fashion worker → Settings → Variables and Secrets.
Add each as a **Secret** (encrypted), then redeploy (or run the GitHub deploy workflow).
Never put these values in the repository.

## Email: Resend

| Secret | Value |
| --- | --- |
| `RESEND_API_KEY` | API key from resend.com → API Keys |
| `EMAIL_FROM` | Sender, e.g. `4L Fashion <orders@4lfashion.com.qa>` |

Verify the sending domain (`4lfashion.com.qa`) in Resend first (it gives DNS records to add),
otherwise the provider rejects the messages.

## WhatsApp: WhatsApp Business Cloud API (Meta)

| Secret | Value |
| --- | --- |
| `WHATSAPP_TOKEN` | Permanent (system user) access token from Meta Business |
| `WHATSAPP_PHONE_NUMBER_ID` | ID of the business phone number (WhatsApp Manager → API setup) |
| `WHATSAPP_TEMPLATE` | Name of an approved *utility* template (see below) |
| `WHATSAPP_TEMPLATE_LANG` | Optional template language code, default `en` |

WhatsApp only allows free-form messages to customers who have written to the business in the
last 24 hours. For order updates, create a template in WhatsApp Manager whose body has three
variables, for example:

> Hi {{1}}, an update on your 4L Fashion order {{2}}: {{3}}

`{{1}}` is the customer's first name, `{{2}}` the order number and `{{3}}` the update text.
Without `WHATSAPP_TEMPLATE`, messages are sent as plain text and only reach customers inside
that 24-hour window.

Qatar numbers entered with 8 digits are sent with the +974 country code.

## Checking it works

After redeploying, open **Admin → Settings → Notifications**: each channel shows
**Automatic** when its keys are present. Use **Send test** to send a test email or WhatsApp.
Every message sent for an order (or a failure and its reason) appears on that order's timeline
as a staff-only entry.
