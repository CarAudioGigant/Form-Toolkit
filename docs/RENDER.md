# Deploy on Render

Live service: **https://caraudiogigant-form-toolkit.onrender.com**  
Dashboard: https://dashboard.render.com/web/srv-dats2j8jo6nc73c96vn0  
Project: CarAudioGigant Form Toolkit  
Repo: https://github.com/CarAudioGigant/Form-Toolkit  

## Configured

- Docker web service (`caraudiogigant-form-toolkit`)
- Persistent disk at `/data` (`DATABASE_URL=file:/data/prod.sqlite`)
- Env: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`, `SHOPIFY_APP_URL`, `NODE_ENV`, `PORT`
- Auto-deploy on push to `main`

## Shopify URLs

`shopify.app.toml` points at the Render hostname for `application_url` and auth redirects.

## After deploy is live

1. Open https://caraudiogigant-form-toolkit.onrender.com
2. Install / open the app on the shop
3. Wire Liquid forms with `forms-gateway.js`

## Note on GitHub visibility

The repo was made **public** so Render could clone it (Render GitHub App only had access to selected private repos). To make it private again: add `Form-Toolkit` under  
https://github.com/organizations/CarAudioGigant/settings/installations/160341208  
then set the repo private.
