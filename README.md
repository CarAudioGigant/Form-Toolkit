# CarAudioGigant Forms Toolkit

Production Shopify app that accepts Liquid storefront form submissions (including file/image uploads) through an **app proxy**, stores files in **Shopify Files**, and saves submissions as **app-owned metaobjects**.

| | |
|--|--|
| **Production URL** | https://caraudiogigant-form-toolkit.onrender.com |
| **GitHub** | https://github.com/CarAudioGigant/Form-Toolkit |
| **Render dashboard** | https://dashboard.render.com/web/srv-dats2j8jo6nc73c96vn0 |

## What it does

- Storefront Liquid forms post via `/apps/forms/*` (Shopify app proxy — Admin API secrets never reach the browser)
- Files upload through staged targets → Shopify Files
- Submissions persist as `$app:form_submission` metaobjects
- Embedded admin lists submissions (Polaris) with field + file detail views

## Production URLs (locked)

Configured in [`shopify.app.toml`](./shopify.app.toml):

| Setting | Value |
|---------|--------|
| App URL | `https://caraudiogigant-form-toolkit.onrender.com` |
| Auth redirects | `/auth/callback`, `/auth/shopify/callback`, `/api/auth/callback` on the same host |
| App proxy | prefix `apps`, subpath `forms` → storefront `/apps/forms/*` |

`automatically_update_urls_on_dev` is **off** so CLI tunnels do not overwrite production URLs.

## Scopes

`write_files`, `write_app_proxy`, `read_metaobjects`, `write_metaobjects`

## Storefront integration

1. Copy [`public/forms-gateway.js`](./public/forms-gateway.js) into the theme `assets/`
2. Mark forms with `data-forms-gateway` and a hidden `form_key`
3. See [docs/liquid-form-example.md](./docs/liquid-form-example.md)

Full API + security docs:

- [docs/API_IMPLEMENTATION_GUIDE.md](./docs/API_IMPLEMENTATION_GUIDE.md)
- [docs/SECURITY.md](./docs/SECURITY.md)
- [docs/RENDER.md](./docs/RENDER.md)

## Hosting (Render)

- Runtime: Docker ([`Dockerfile`](./Dockerfile))
- Persistent disk at `/data` for SQLite sessions (`DATABASE_URL=file:/data/prod.sqlite`)
- Env vars: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SCOPES`, `DATABASE_URL`, `NODE_ENV`, `PORT`
- Auto-deploys from `main` on GitHub

## Releasing Shopify config

After changing `shopify.app.toml`:

```shell
shopify app deploy --allow-updates
```

## Stack

- React Router + `@shopify/shopify-app-react-router`
- Prisma (OAuth session storage only)
- Shopify Files + Metaobjects for submission data
