# Liquid form → Forms Gateway

This app does **not** render forms. Keep your existing Liquid forms and point them at the app proxy.

**Full reference:** [API Implementation Guide](./API_IMPLEMENTATION_GUIDE.md) (architecture, endpoint schemas, errors, custom clients, troubleshooting).

Storefront endpoints (no Admin API secrets in the theme):

| Method | Storefront path | Purpose |
|--------|-----------------|--------|
| `GET` | `/apps/forms/session` | Bootstrap short-lived gateway session (required first) |
| `POST` | `/apps/forms/staged-upload` | Get a temporary Shopify staging URL |
| `POST` | `/apps/forms/submit` | Save fields + attach uploaded files |

Security: only the **installed** shop via app proxy; curl/console against the app host are rejected. See [SECURITY.md](./SECURITY.md).

## 1. Host the helper script

Copy [`public/forms-gateway.js`](../public/forms-gateway.js) into your theme `assets/` folder (or load it from your CDN).

```liquid
{{ 'forms-gateway.js' | asset_url | script_tag }}
```

## 2. Mark the form

Add `data-forms-gateway`, a hidden `form_key`, and keep any fields/files you already have:

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
    <input type="text" name="name" required />
  </label>

  <label>
    Email
    <input type="email" name="email" required />
  </label>

  <label>
    Notes
    <textarea name="notes"></textarea>
  </label>

  <label>
    Photos
    <input type="file" name="photos" accept="image/*,application/pdf" multiple />
  </label>

  <button type="submit">Send</button>
</form>
```

`form_key` values show up in the app admin (e.g. `warranty`, `install-quote`). Use a unique key per form.

## 3. What happens on submit

1. JS reads all non-file fields.
2. For each selected file it calls `/apps/forms/staged-upload`, then uploads bytes to Shopify’s staging URL.
3. It POSTs JSON to `/apps/forms/submit` with `form_key`, `fields`, and staged `resourceUrl`s.
4. The app creates Shopify Files server-side and stores the submission as an **app-owned metaobject** (`$app:form_submission`).

Optional events:

```js
document.addEventListener('forms-gateway:success', (e) => {
  console.log('submission id', e.detail.id);
});
document.addEventListener('forms-gateway:error', (e) => {
  console.error(e.detail.error);
});
```

## Limits

- Images: `jpeg`, `png`, `webp`, `gif`
- Documents: `pdf`
- Max 20MB per file, 10 files per submission

## Manual bind

If the form is injected dynamically:

```js
FormsGateway.bind(document.querySelector('#my-form'));
```
