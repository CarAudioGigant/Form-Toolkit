# Security audit — Forms Gateway

Focus: APIs run **only for the shop that installed the app**, and **cannot be casually invoked from curl, Postman, or browser console** against the app host.

Audit date: 2026-09-29 (hardened pass)

---

## Guarantees

| Attack | Result |
|--------|--------|
| `curl` / Postman / console against tunnel or app URL | **401** — no Shopify app-proxy HMAC (`shop` + `timestamp` + `signature`) |
| Proxy request for a shop that never installed / uninstalled | **401** — no offline Session / token |
| Shop A signature with Shop B session | **401** — shop mismatch |
| Stale replayed proxy URL | **401** — timestamp older than 5 minutes |
| `fetch('/apps/forms/submit')` without bootstrap | **401** — missing gateway session + `X-Forms-Gateway` header |
| Arbitrary `resourceUrl` | **400** — host allowlist |
| After uninstall webhook | Sessions deleted → all proxy mutations **401** |

---

## Defense layers (in order)

1. **App proxy only** — `assertAppProxyQuery` requires `shop`, `timestamp`, `signature`/`hmac`
2. **Fresh timestamp** — max age 5 minutes (replay resistance)
3. **HMAC** — `authenticate.public.appProxy` (Shopify-signed with app secret)
4. **Installed shop** — offline Session with access token + Prisma re-check
5. **Shop bind** — normalized `session.shop === shop` query param
6. **Gateway session** — short-lived HMAC token (`SHOPIFY_API_SECRET`), 15 minutes  
   - Issued only by `GET /apps/forms/session` through the proxy  
   - Sent as `X-Forms-Gateway-Session` (memory in `forms-gateway.js`) and/or HttpOnly cookie  
   - Cleared after successful submit
7. **CSRF-style header** — `X-Forms-Gateway: 1` required on mutations
8. **JSON only** — mutating endpoints reject non-JSON content types
9. **Staged URL allowlist** — HTTPS Shopify staging hosts only
9. **Staged URL allowlist** — HTTPS Shopify staging hosts only

Generic `{ "error": "Unauthorized" }` responses avoid leaking which check failed.

---

## Why console on the *storefront* is different

Browser DevTools on `https://{shop}/...` can still call `/apps/forms/*` because Shopify attaches a valid proxy signature. That is same-origin storefront traffic, not “open Admin API.”

Hardening against casual console abuse:

- Require bootstrap session + custom headers (stops one-liner console submits)
- Session token not attached to `window.FormsGateway`

A determined attacker on the storefront page can still reverse-engineer the bootstrap → submit flow; that is inherent to public Liquid forms without a captcha (intentionally not used).

---

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/apps/forms/session` | Proxy HMAC + installed shop → issues session |
| `POST` | `/apps/forms/staged-upload` | Proxy + installed + session + header |
| `POST` | `/apps/forms/submit` | Proxy + installed + session + header |

---

## Source

- [`app/services/installed-shop.server.js`](../app/services/installed-shop.server.js)
- [`app/routes/apps.forms.session.jsx`](../app/routes/apps.forms.session.jsx)
- [`public/forms-gateway.js`](../public/forms-gateway.js)
