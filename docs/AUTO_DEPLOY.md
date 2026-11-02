# GitHub → Cloudflare auto-deploy

The GitHub Actions workflow `.github/workflows/deploy-cloudflare.yml` runs on each push or merge to `main`. It can also be started manually from the Actions tab. Production deployments run sequentially, not concurrently.

## One-time activation

1. In Cloudflare, create an API token using the **Edit Cloudflare Workers** template, scoped to your account/Worker. Include **D1 Edit** because the workflow creates missing database tables. Keep permissions scoped to the target account. See Cloudflare's [GitHub Actions guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) and [permissions reference](https://developers.cloudflare.com/workers/authorization/).
2. Copy your Cloudflare **account ID**. This is different from the D1 database ID.
3. In GitHub → this repository → **Settings → Secrets and variables → Actions → Secrets**, create:

| Repository secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | The scoped Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account ID |

4. Under the same page's **Variables** tab, set these only if your live deployment differs from the defaults:

| Repository variable | Default if absent |
| --- | --- |
| `CLOUDFLARE_WORKER_NAME` | `4l-fashion-commerce` |
| `CLOUDFLARE_R2_BUCKET` | `site-creator-r2` |
| `CLOUDFLARE_D1_DATABASE_ID` | `bb87f23d-a634-4eec-b6ce-4cbed72c27e9` |

Use the exact existing live Worker name and bucket name. This updates that Worker; a different name targets a different Worker. The bucket must already exist; this workflow does not create it. Bindings remain `DB` and `BUCKET`.

5. Open **Actions → Deploy 4L Fashion to Cloudflare → Run workflow → main**. Missing secrets produce a clear setup error; after adding them, rerun the failed job. If Actions is disabled for the repository, enable it there first.

After activation, future pushes to `main` test, build and deploy automatically. Review the Actions run log for confirmation. If Cloudflare's native Git/Workers Builds integration is also enabled, use one deployment system for this Worker to avoid duplicate/racing deployments.

## Pipeline

- Check credential presence without printing values.
- Node 22 + pinned pnpm 11.25.0, frozen lockfile install.
- TypeScript and commerce/offline/Google OAuth tests.
- Worker build and precached PWA assets.
- Apply `scripts/cloudflare-bootstrap.sql` to create missing tables, preserving existing records.
- Deploy the generated Worker using the repository's pinned Wrangler version.

The SQL step covers the six current tables, including Google login. It uses CREATE TABLE IF NOT EXISTS and never deletes orders/products or seeds sample data. It is an initial-schema bootstrap, not an automatic ALTER/backfill engine. Add reviewed versioned steps when future changes modify existing schemas.

Cloudflare runtime Google values (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, `OWNER_EMAIL`) stay in the Worker, not this workflow. `keep_vars` preserves dashboard-managed text variables, and runtime secrets remain on Cloudflare. See [Google login setup](GOOGLE_LOGIN.md).

No Cloudflare token has been added on your behalf. Deployment cannot authenticate until the repository secrets above exist. Do not paste tokens into source files or chat.
