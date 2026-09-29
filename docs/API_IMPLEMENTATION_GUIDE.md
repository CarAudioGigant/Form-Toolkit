# Forms Gateway — Complete API Implementation Guide

In-depth reference for integrating storefront Liquid forms with **CarAudioGigant Forms Toolkit**.

This app is a **gateway only**: it does not build or host form UIs. Existing Liquid forms post through Shopify’s **app proxy**. Admin API credentials never reach the browser. Uploaded files are stored in **Shopify Files**. Submissions are stored in the app database and listed in the embedded admin.

Related quick-start: [Liquid form example](./liquid-form-example.md)  
Storefront helper: [`public/forms-gateway.js`](../public/forms-gateway.js)

---

## Table of contents

1. [Architecture overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [App proxy mapping](#3-app-proxy-mapping)
4. [Security model](#4-security-model)
5. [Upload flow (end-to-end)](#5-upload-flow-end-to-end)
6. [API reference](#6-api-reference)
7. [Validation & limits](#7-validation--limits)
8. [Error handling](#8-error-handling)
9. [Rate limiting](#9-rate-limiting)
10. [Liquid + JavaScript integration](#10-liquid--javascript-integration)
11. [Custom client implementation](#11-custom-client-implementation)
12. [Admin UI](#12-admin-ui)
13. [Data model](#13-data-model)
14. [Testing checklist](#14-testing-checklist)
15. [Troubleshooting](#15-troubleshooting)
16. [Source map](#16-source-map)
17. [Security (installed shops only)](./SECURITY.md)

---

## 1. Architecture overview

```
┌─────────────────┐     App Proxy (HMAC)     ┌──────────────────────┐
│  Storefront     │ ───────────────────────► │  This Shopify App    │
│  Liquid + JS    │                          │  /apps/forms/*       │
└────────┬────────┘                          └──────────┬───────────┘
         │                                              │
         │  2. Upload bytes to staged URL               │ 1. stagedUploadsCreate
         │     (Google Cloud / Shopify staging)         │ 3. fileCreate
         ▼                                              ▼
┌─────────────────┐                          ┌──────────────────────┐
│  Staged storage │                          │  Shopify Files CDN   │
└─────────────────┘                          │  + Prisma submissions│
                                             └──────────────────────┘
```

### Why two API steps?

Shopify app proxies have practical body-size limits. Large car-audio photos should **not** be posted as multipart through the proxy.

Instead:

1. **Staged upload** — small JSON request; app returns a temporary upload URL + signed parameters.
2. **Browser → staging** — file bytes go directly to Shopify’s staging host (not your Admin token).
3. **Submit** — small JSON with field values + `resourceUrl`s; app runs `fileCreate` and saves the submission.

---

## 2. Prerequisites

| Requirement | Details |
|-------------|---------|
| App installed on the shop | Offline session required so app proxy can call Admin GraphQL |
| Scopes | `write_files`, `write_app_proxy` |
| App proxy config | See `shopify.app.toml` `[app_proxy]` |
| Theme access | Ability to add a JS asset and mark forms with `data-forms-gateway` |
| Dev | `shopify app dev` so proxy URLs and scopes sync to the dev store |

Current config:

```toml
[access_scopes]
scopes = "write_files,write_app_proxy"

[app_proxy]
url = "/apps/forms"
prefix = "apps"
subpath = "forms"
```

After changing scopes, re-approve the app install on the store.

---

## 3. App proxy mapping

Shopify rewrites storefront paths under `/{prefix}/{subpath}` to your app.

| Storefront URL (customer-facing) | Proxied to app route |
|----------------------------------|----------------------|
| `https://{shop}/apps/forms/staged-upload` | `POST /apps/forms/staged-upload` |
| `https://{shop}/apps/forms/submit` | `POST /apps/forms/submit` |

Notes:

- Always call the **storefront** paths (`/apps/forms/...`), never your Cloudflare/tunnel app URL from Liquid. That is what keeps signature verification working.
- Shopify appends query params such as `shop`, `logged_in_customer_id`, `timestamp`, `signature` when proxying.
- Relative `fetch('/apps/forms/submit')` from the storefront is correct.

Official docs: [About app proxies](https://shopify.dev/docs/apps/build/online-store/app-proxies)

---

## 4. Security model

Full audit notes: [SECURITY.md](./SECURITY.md)

| Concern | How it is handled |
|---------|-------------------|
| Admin API secret / access token | Never sent to the browser. Only used server-side after app-proxy auth |
| Direct curl / console against app host | **Blocked** — requires Shopify proxy `shop` + `timestamp` + `signature` (fresh ≤5 min) |
| **Installed shop only** | Offline Session + access token + Prisma re-check; uninstall deletes sessions |
| Casual storefront console `fetch` to submit | **Blocked** without prior `GET /apps/forms/session` + `X-Forms-Gateway` + session header |
| Gateway session | Short-lived HMAC token (15 min), kept in JS memory by `forms-gateway.js`, cleared after submit |
| Shop isolation | Submissions stored with gated `shop`; admin loaders filter by `session.shop` |
| Staged `resourceUrl` | Must be `https` on allowed Shopify staging hosts |
| Abuse | In-process rate limits per shop + IP |

**Do not** call Admin GraphQL from theme Liquid or storefront JS. **Do not** embed `SHOPIFY_API_SECRET` or offline tokens in the theme.

### Required client flow

```
GET  /apps/forms/session          → sessionToken (+ Set-Cookie)
POST /apps/forms/staged-upload    → headers: X-Forms-Gateway: 1, X-Forms-Gateway-Session: <token>
POST /apps/forms/submit           → same headers
```

Use [`public/forms-gateway.js`](../public/forms-gateway.js) — do not hand-roll console calls.

---

## 5. Upload flow (end-to-end)

```
Customer submits Liquid form
        │
        ▼
forms-gateway.js intercepts submit
        │
        ├─ For each file:
        │     POST /apps/forms/staged-upload  { filename, mimeType, fileSize }
        │           │
        │           ▼
        │     App → stagedUploadsCreate (Admin API)
        │           │
        │           ▼
        │     Returns { url, parameters, resourceUrl }
        │           │
        │           ▼
        │     Browser POST/PUT file to staging url (with parameters)
        │
        ▼
POST /apps/forms/submit
  { form_key, fields, files: [{ fieldName, filename, mimeType, size, resourceUrl }] }
        │
        ▼
App → fileCreate for each resourceUrl
App → Prisma FormSubmission + FormSubmissionFile
        │
        ▼
JSON { ok: true, id, fileCount }
Admin UI lists submission under Submissions
```

Shopify Files processing is asynchronous. Immediately after `fileCreate`, `fileStatus` may be `PROCESSING`. URLs may become fully available shortly after; the admin detail page shows whatever URL was returned at create time (or a “not ready” message).

---

## 6. API reference

All storefront endpoints:

- Method: **`POST` only** (GET returns `405`)
- Content-Type: **`application/json`**
- Auth: App proxy signature (automatic when called via `/apps/forms/...` on the shop domain)

---

### 6.1 Create staged upload target

**Endpoint:** `POST /apps/forms/staged-upload`

Creates a temporary upload target via Admin `stagedUploadsCreate`.

#### Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filename` | string | yes | Original file name including extension |
| `mimeType` | string | yes | Must be in the [allowed MIME list](#7-validation--limits) |
| `fileSize` | number | yes | Size in bytes; must be `> 0` and `≤ 20MB` |
| `httpMethod` | `"POST"` \| `"PUT"` | no | Default `POST`. Use `POST` with `FormData` (recommended) |

Example:

```json
{
  "filename": "dash-cam.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 1843200,
  "httpMethod": "POST"
}
```

#### Success response `200`

```json
{
  "ok": true,
  "url": "https://shopify-staged-uploads.storage.googleapis.com/...",
  "resourceUrl": "https://shopify-staged-uploads.storage.googleapis.com/...",
  "parameters": [
    { "name": "key", "value": "tmp/..." },
    { "name": "Content-Type", "value": "image/jpeg" },
    { "name": "success_action_status", "value": "201" },
    { "name": "acl", "value": "private" },
    { "name": "policy", "value": "..." },
    { "name": "x-goog-credential", "value": "..." },
    { "name": "x-goog-algorithm", "value": "GOOG4-RSA-SHA256" },
    { "name": "x-goog-date", "value": "..." },
    { "name": "x-goog-signature", "value": "..." }
  ],
  "httpMethod": "POST"
}
```

| Field | Description |
|-------|-------------|
| `url` | Host to upload the file bytes to |
| `parameters` | Form fields required by Shopify staging (append **before** the file field) |
| `resourceUrl` | Pass this later to `/submit` as `files[].resourceUrl` |
| `httpMethod` | Echo of the method to use for the staging upload |

#### Uploading bytes to the staged URL (`POST`)

```js
const formData = new FormData();
target.parameters.forEach(({ name, value }) => formData.append(name, value));
formData.append("file", file); // must be last

await fetch(target.url, { method: "POST", body: formData });
```

For `PUT`, send the raw file body with the correct `Content-Type` header (no multipart parameters in the same way). Prefer `POST` unless you have a reason to use `PUT`.

#### Failure responses

See [Error handling](#8-error-handling).

---

### 6.2 Submit form (fields + files)

**Endpoint:** `POST /apps/forms/submit`

Creates Shopify File assets from staged `resourceUrl`s, then persists a submission.

#### Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `form_key` | string | yes | Identifier for the Liquid form (`formKey` also accepted) |
| `fields` | object | no | Arbitrary string key/value map of non-file fields (default `{}`) |
| `files` | array | no | Staged files metadata (default `[]`) |

**`files[]` item:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fieldName` | string | recommended | Input `name` from the form (fallback `file_0`, …) |
| `filename` | string | recommended | Original filename |
| `mimeType` | string | yes | Allowed MIME type |
| `size` | number | yes | Bytes |
| `resourceUrl` | string | yes | From staged-upload response |

Example:

```json
{
  "form_key": "install-quote",
  "fields": {
    "name": "Alex Rivera",
    "email": "alex@example.com",
    "vehicle": "2022 Honda Civic",
    "notes": "Need amp + sub install"
  },
  "files": [
    {
      "fieldName": "photos",
      "filename": "trunk.jpg",
      "mimeType": "image/jpeg",
      "size": 2048000,
      "resourceUrl": "https://shopify-staged-uploads.storage.googleapis.com/..."
    }
  ]
}
```

#### Success response `200`

```json
{
  "ok": true,
  "id": "clxyz0123456789",
  "fileCount": 1
}
```

| Field | Description |
|-------|-------------|
| `id` | Prisma submission id (use in admin deep links) |
| `fileCount` | Number of files attached |

#### Captured automatically

| Data | Source |
|------|--------|
| `shop` | App proxy session |
| `customerId` | `logged_in_customer_id` query param when customer is logged in |
| `ip` | `x-forwarded-for` / `cf-connecting-ip` |
| `userAgent` | `User-Agent` header |

---

## 7. Validation & limits

Defined in `app/services/upload-limits.server.js`:

| Rule | Value |
|------|-------|
| Max file size | **20 MB** per file |
| Max files per submit | **10** |
| Max field keys | **100** |
| Max field value length | **10,000** characters (truncated) |
| Max `form_key` length | **100** characters |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf` |

Images use Shopify staged resource `IMAGE` / file content type `IMAGE`.  
PDFs use resource `FILE` / content type `FILE`.

Unsupported MIME types return `400` with a clear error message.

---

## 8. Error handling

All error bodies:

```json
{ "error": "Human-readable message" }
```

| HTTP | When |
|------|------|
| `400` | Invalid JSON, validation failure, Shopify userErrors, missing `form_key`, bad MIME/size |
| `401` | App not installed / no offline session for the shop |
| `405` | Method is not `POST` |
| `429` | Rate limit exceeded |

### Client pattern

```js
const res = await fetch("/apps/forms/submit", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify(payload),
  credentials: "same-origin",
});

const data = await res.json().catch(() => ({}));
if (!res.ok || !data.ok) {
  throw new Error(data.error || `Request failed (${res.status})`);
}
```

---

## 9. Rate limiting

In-process (per Node process), keyed by shop + client IP:

| Endpoint | Limit | Window |
|----------|-------|--------|
| staged-upload | 40 requests | 60 seconds |
| submit | 20 requests | 60 seconds |

Exceeding the limit returns `429` `{ "error": "Too many requests" }`.

For multi-instance production hosting, replace with a shared store (Redis) if needed.

---

## 10. Liquid + JavaScript integration

### 10.1 Install the helper

Copy `public/forms-gateway.js` into the theme `assets/` folder:

```liquid
{{ 'forms-gateway.js' | asset_url | script_tag }}
```

### 10.2 Mark each form

```liquid
<form
  data-forms-gateway
  data-success-redirect="/pages/thank-you"
  method="post"
  enctype="multipart/form-data"
>
  <input type="hidden" name="form_key" value="install-quote" />

  <label>
    Name
    <input type="text" name="name" required>
  </label>

  <label>
    Email
    <input type="email" name="email" required>
  </label>

  <label>
    Vehicle
    <input type="text" name="vehicle">
  </label>

  <label>
    Photos / PDF
    <input
      type="file"
      name="photos"
      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
      multiple
    >
  </label>

  <button type="submit">Submit</button>
</form>
```

### 10.3 Form attributes

| Attribute | Effect |
|-----------|--------|
| `data-forms-gateway` | Auto-binds on `DOMContentLoaded` |
| `data-success-redirect` | Navigate here after success |
| `data-no-reset` | Do not `form.reset()` after success (ignored if redirect is set) |
| `name="form_key"` (hidden) | **Required** — labels the submission in admin |

### 10.4 Events

```js
document.addEventListener("forms-gateway:success", (event) => {
  console.log("Submission id:", event.detail.id);
  console.log("Files:", event.detail.fileCount);
});

document.addEventListener("forms-gateway:error", (event) => {
  console.error(event.detail.error);
});
```

### 10.5 Dynamic forms

```js
FormsGateway.bind(document.querySelector("#ajax-injected-form"));
```

### 10.6 Multiple forms on one page

Use a unique `form_key` per form. Auto-bind attaches to every `form[data-forms-gateway]`.

Examples:

- `warranty-claim`
- `install-quote`
- `trade-in`
- `contact-support`

---

## 11. Custom client implementation

If you cannot use `forms-gateway.js`, implement the same protocol:

```js
async function submitWithUploads({ formKey, fields, fileList }) {
  const uploaded = [];

  for (const { fieldName, file } of fileList) {
    const stagedRes = await fetch("/apps/forms/staged-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        httpMethod: "POST",
      }),
    });
    const staged = await stagedRes.json();
    if (!stagedRes.ok || !staged.ok) throw new Error(staged.error);

    const body = new FormData();
    staged.parameters.forEach((p) => body.append(p.name, p.value));
    body.append("file", file);

    const up = await fetch(staged.url, { method: "POST", body });
    if (!up.ok) throw new Error("Staged byte upload failed");

    uploaded.push({
      fieldName,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      resourceUrl: staged.resourceUrl,
    });
  }

  const submitRes = await fetch("/apps/forms/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      form_key: formKey,
      fields,
      files: uploaded,
    }),
  });
  const result = await submitRes.json();
  if (!submitRes.ok || !result.ok) throw new Error(result.error);
  return result;
}
```

### cURL (debug only)

App proxy HMAC is required in production. Raw cURL against the tunnel **without** a valid Shopify proxy signature will fail authentication. Prefer testing from the live storefront or a signed proxy request.

---

## 12. Admin UI

| Path | Purpose |
|------|---------|
| `/app` | Paginated submissions list (25 per page) |
| `/app/submissions/:id` | Field map + file previews/links |

List columns: form key, submitted time, field count, file count.

Files open via Shopify CDN URLs when available. Images show a thumbnail.

---

## 13. Data model

### `FormSubmission`

| Column | Type | Notes |
|--------|------|-------|
| `id` | string (cuid) | Primary key |
| `shop` | string | Myshopify domain |
| `formKey` | string | From `form_key` |
| `fields` | string | JSON-encoded object |
| `customerId` | string? | Logged-in customer |
| `ip` | string? | |
| `userAgent` | string? | |
| `createdAt` | datetime | |

### `FormSubmissionFile`

| Column | Type | Notes |
|--------|------|-------|
| `id` | string (cuid) | |
| `submissionId` | string | FK → FormSubmission |
| `fieldName` | string | Form input name |
| `filename` | string | |
| `mimeType` | string | |
| `size` | int | Bytes |
| `shopifyFileId` | string | GID e.g. `gid://shopify/MediaImage/...` |
| `url` | string | CDN / resource URL |
| `createdAt` | datetime | |

Schema: `prisma/schema.prisma`

---

## 14. Testing checklist

- [ ] App installed; scopes include `write_files` and `write_app_proxy`
- [ ] `shopify app dev` running; proxy reachable at `/apps/forms/...`
- [ ] `forms-gateway.js` loaded on the page (Network tab)
- [ ] Form has `data-forms-gateway` and hidden `form_key`
- [ ] Submit text-only form → appears in app admin
- [ ] Submit with JPEG under 20MB → file in Shopify **Content → Files** and on submission detail
- [ ] Submit PDF → stored as generic file
- [ ] Reject `.exe` / unsupported MIME → user-visible error
- [ ] Oversize file → error mentioning 20MB
- [ ] Second form with different `form_key` → separate rows in admin
- [ ] Pagination: create >25 submissions, verify Next/Previous

---

## 15. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `401` App is not installed | Missing offline session | Reinstall app / complete OAuth |
| `405` Use POST | GET or wrong method | Use `POST` + JSON |
| CORS / failed fetch to tunnel URL | Calling app URL instead of shop proxy | Use relative `/apps/forms/...` |
| Staged upload OK, submit fails on `fileCreate` | Bad/expired `resourceUrl`, or scope missing | Ensure upload finished; confirm `write_files` |
| Empty MIME `application/octet-stream` | Browser omitted type | Set `accept` on input; map extension → MIME client-side before staged-upload |
| Files missing in admin but submission exists | `files: []` submitted | Ensure file inputs have `name` and gateway upload loop ran |
| Proxy 404 | Wrong subpath / not deployed | Confirm `[app_proxy]` and restart `shopify app dev` |
| Signature errors | Hitting app host directly | Always use storefront proxy path |

Shopify references:

- [stagedUploadsCreate](https://shopify.dev/docs/api/admin-graphql/latest/mutations/stagedUploadsCreate)
- [fileCreate](https://shopify.dev/docs/api/admin-graphql/latest/mutations/fileCreate)
- [App proxies](https://shopify.dev/docs/apps/build/online-store/app-proxies)

---

## 16. Source map

| Concern | Path |
|---------|------|
| Staged-upload route | `app/routes/apps.forms.staged-upload.jsx` |
| Submit route | `app/routes/apps.forms.submit.jsx` |
| Shopify Files helpers | `app/services/shopify-files.server.js` |
| Submission persistence | `app/services/submissions.server.js` |
| Limits | `app/services/upload-limits.server.js` |
| Rate limit | `app/services/rate-limit.server.js` |
| Admin list | `app/routes/app._index.jsx` |
| Admin detail | `app/routes/app.submissions.$id.jsx` |
| Storefront helper | `public/forms-gateway.js` |
| App config | `shopify.app.toml` |

---

## Quick reference card

```
POST /apps/forms/staged-upload
  → { filename, mimeType, fileSize, httpMethod? }
  ← { ok, url, parameters, resourceUrl, httpMethod }

POST (browser) → staged url + parameters + file bytes

POST /apps/forms/submit
  → { form_key, fields, files: [{ fieldName, filename, mimeType, size, resourceUrl }] }
  ← { ok, id, fileCount }
```

Keep forms in Liquid. Keep secrets on the server. Use the proxy. Upload bytes to staging. Submit metadata + `resourceUrl`s.
