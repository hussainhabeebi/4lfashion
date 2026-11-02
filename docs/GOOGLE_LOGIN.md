# Enable Google Login on Cloudflare

The repository now implements Google OpenID Connect sign-in with D1-backed sessions. No password, Google access token or refresh token is stored. Google manages account passwords and recovery.

## 1. Create the Google OAuth client

In [Google Cloud Console](https://console.cloud.google.com/auth/overview), select/create your project and configure Google Auth Platform branding/audience. Create a client with application type **Web application**.

Use your actual primary HTTPS website origin throughout. For example, if the live store is `https://shop.example.com`:

- Authorised JavaScript origin (if requested): `https://shop.example.com`
- Authorised redirect URI: `https://shop.example.com/api/auth/google/callback`

The redirect URI must match exactly, including scheme, hostname and path. No trailing slash after `callback`. The backend requests only `openid email profile` and uses authorization code flow with PKCE, state and nonce.

If your Google OAuth app is restricted to test users, add the owner and staff accounts there during testing. Complete the applicable Google production publishing requirements before customer rollout.

Copy the client ID and client secret into Cloudflare. Do not put the secret into GitHub, client JavaScript or a chat message.

## 2. Configure Cloudflare runtime settings

Open the Worker → **Settings → Variables and Secrets** and add:

| Name | Value | Type |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | The Google Web application client ID | Text or Secret |
| `GOOGLE_CLIENT_SECRET` | The Google client secret | Secret |
| `APP_URL` | Your primary HTTPS origin, e.g. `https://shop.example.com` | Text or Secret |
| `OWNER_EMAIL` | The exact verified Google email that should own the store | Text or Secret |

`APP_URL` is an origin only, not a path. Do not include `/admin`, query parameters or a trailing slash. Configure runtime values, not only build-time variables. `keep_vars` preserves dashboard-managed text variables during Wrangler deployments; secrets are never committed to source.

Retain the existing D1 binding named `DB` with database ID `bb87f23d-a634-4eec-b6ce-4cbed72c27e9`. Product image uploads also need the existing R2 binding `BUCKET`; Google sign-in itself does not use R2.

## 3. Add the authentication tables

If the three original commerce tables already exist, apply **only** `drizzle/0001_useful_guardsmen.sql`. In D1 Console, run its three CREATE TABLE statements once. They add `auth_flows`, `auth_sessions` and `auth_users`; existing products/orders are preserved.

Alternatively, after building and logging Wrangler into your own Cloudflare account:

```sh
pnpm exec wrangler d1 execute DB --remote --config dist/server/wrangler.json --file drizzle/0001_useful_guardsmen.sql
```

For a completely empty database, apply `drizzle/0000_sad_nitro.sql` first, followed by `0001_useful_guardsmen.sql`. Never replay a migration already applied to the same database.

## 4. Deploy and first login

Use the existing build command `pnpm build` and deploy command:

```sh
pnpm exec wrangler deploy --config dist/server/wrangler.json
```

Save/deploy your Cloudflare runtime changes, then open `https://YOUR-DOMAIN/admin/login`. Continue with Google using the account in `OWNER_EMAIL`. If no owner record exists yet, that exact verified account becomes owner; another signed-in visitor cannot claim the store. An existing owner record is never silently replaced by changing the environment variable. If migrating an already-initialised private review database, keep the existing owner's email or add the intended account as staff through the existing administrator.

Open `/admin`, choose **Initialise store** only for a new catalogue, then add staff under **Staff & permissions**. Admins and managers have operational access. Customer Google sign-in does not grant management access.

Existing customers from the old ChatGPT identity system are not automatically linked by email; Google users have stable `google:<subject>` identifiers. Existing products and orders remain untouched.

## 5. Verify

- Configured owner can log in and reach Products, Orders, POS and Accounting.
- A different Google customer cannot initialise the store or access admin APIs, uploads or POS.
- Approved staff can log in with their exact configured Google email.
- Logout removes the server session and device-private snapshots. Pending offline work must be synced first.
- Expired sessions require sign-in again while online. Offline registers use their previously authorised device snapshots; reconnect sync rechecks the current user and permissions.
- Offline work cannot sync under a different staff account. It remains queued for the original account.

The service worker excludes login/auth endpoints and updates the installed app shell to version 2. First login still needs internet. If you use Cloudflare Access on `/admin`, keep the Google callback and other authentication endpoints reachable as appropriate to your Access policy.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Google setup message | All required runtime values are set and deployed; `DB` is bound. |
| `redirect_uri_mismatch` from Google | The exact primary-domain callback URI above is authorised. |
| Sign-in request expired | Start again on `/admin/login`; use the same browser and primary domain. |
| Google succeeds but sign-in fails | Apply auth migration; check client ID/secret and Worker logs without logging tokens. |
| Logged in but access denied | Use the account in `OWNER_EMAIL` for a new store, or have the owner add the verified email under Staff. |
| New domain | Update both `APP_URL` and the Google redirect URI, then redeploy. |

References: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Google web server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Cloudflare runtime secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
