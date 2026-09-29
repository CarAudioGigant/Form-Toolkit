# Deploy on Render

This Shopify app is set up for **Render** (Docker + persistent disk for SQLite).

Repo: https://github.com/CarAudioGigant/Form-Toolkit  
Blueprint: [`render.yaml`](../render.yaml)

## 1. Connect the service

If you already created **CarAudioGigant Form Toolkit** in Render:

1. Link the GitHub repo `CarAudioGigant/Form-Toolkit` (branch `main`).
2. Runtime: **Docker** (uses the repo `Dockerfile`).
3. Attach a **persistent disk** at mount path `/data` (required — SQLite must survive deploys).
4. Health check path: `/`

Or create from Blueprint: Dashboard → **New** → **Blueprint** → select this repo.

## 2. Environment variables

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` (or leave Render default and ensure the app reads `PORT`) |
| `DATABASE_URL` | `file:/data/prod.sqlite` |
| `SCOPES` | `write_files,write_app_proxy` |
| `SHOPIFY_API_KEY` | From Partner Dashboard → App → Client ID |
| `SHOPIFY_API_SECRET` | From Partner Dashboard → App → Client secret |
| `SHOPIFY_APP_URL` | Your Render URL, e.g. `https://caraudiogigant-form-toolkit.onrender.com` |

No trailing slash on `SHOPIFY_APP_URL`.

## 3. Point Shopify at Render

In Partner Dashboard / `shopify.app.toml` (then `shopify app deploy`):

- **App URL** = `SHOPIFY_APP_URL`
- **Allowed redirection URL(s)** = `{SHOPIFY_APP_URL}/auth/callback` (and related auth paths Shopify lists)
- App proxy stays `prefix=apps` / `subpath=forms` → storefront `/apps/forms/*`

## 4. After first deploy

1. Open the Render URL — you should see the login / app landing page.
2. Install the app on the shop (OAuth).
3. Confirm admin **Submissions** loads.
4. Wire Liquid forms with `forms-gateway.js` (see [liquid-form-example.md](./liquid-form-example.md)).

## Local vs Render DB

- Local: `DATABASE_URL=file:./dev.sqlite` (see `.env.example`)
- Render: `DATABASE_URL=file:/data/prod.sqlite` on the persistent disk

## Notes

- Free/web instances without a disk lose the SQLite file on every deploy — use the disk.
- For multi-instance scaling later, switch Prisma to Postgres and drop the disk.
