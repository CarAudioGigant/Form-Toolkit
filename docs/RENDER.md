# Deploy on Render (production)

Live service: **https://caraudiogigant-form-toolkit.onrender.com**  
Dashboard: https://dashboard.render.com/web/srv-dats2j8jo6nc73c96vn0  
Project: CarAudioGigant Form Toolkit  
Repo: https://github.com/CarAudioGigant/Form-Toolkit  

## Production setup

- Docker web service (`caraudiogigant-form-toolkit`)
- Persistent disk at `/data` (`DATABASE_URL=file:/data/prod.sqlite`)
- Env: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`, `SHOPIFY_APP_URL`, `NODE_ENV`, `PORT`
- Auto-deploy on push to `main`
- Shopify app URLs locked to this host (`automatically_update_urls_on_dev = false`)

## Shopify URLs

| Setting | Value |
|---------|--------|
| App URL | `https://caraudiogigant-form-toolkit.onrender.com` |
| Redirect URLs | `…/auth/callback`, `…/auth/shopify/callback`, `…/api/auth/callback` |
| App proxy | `/apps/forms/*` on the shop domain |

## After deploy

1. Open the production URL and install/open the app on the shop
2. Confirm scopes include metaobjects + files
3. Wire Liquid forms with `forms-gateway.js`

## GitHub / Render access

If the repo is private, ensure the Render GitHub App can access `CarAudioGigant/Form-Toolkit`:  
https://github.com/organizations/CarAudioGigant/settings/installations/160341208
