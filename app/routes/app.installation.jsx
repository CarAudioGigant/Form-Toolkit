import { useCallback, useState } from "react";
import { Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return {};
};

const SCRIPT_TAG = `{{ 'forms-gateway.js' | asset_url | script_tag }}`;

const FORM_EXAMPLE = `<form
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
    Vehicle
    <input type="text" name="vehicle" />
  </label>

  <label>
    Photos / PDF
    <input
      type="file"
      name="photos"
      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
      multiple
    />
  </label>

  <button type="submit">Submit</button>
</form>`;

const EVENTS_EXAMPLE = `document.addEventListener("forms-gateway:success", (event) => {
  console.log("Submission id:", event.detail.id);
  console.log("Files:", event.detail.fileCount);
});

document.addEventListener("forms-gateway:error", (event) => {
  console.error(event.detail.error);
});`;

const BIND_EXAMPLE = `FormsGateway.bind(document.querySelector("#ajax-injected-form"));`;

function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [text]);

  return (
    <button type="button" className="cag-code__copy" onClick={onCopy}>
      {copied ? "Copied" : label}
    </button>
  );
}

function CodeBlock({ code, label }) {
  return (
    <div className="cag-code">
      <div className="cag-code__bar">
        <span>{label}</span>
        <CopyButton text={code} />
      </div>
      <pre className="cag-code__pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Step({ number, title, children }) {
  return (
    <section className="cag-guide__step">
      <div className="cag-guide__step-head">
        <span className="cag-guide__step-num" aria-hidden="true">
          {number}
        </span>
        <h2 className="cag-guide__step-title">{title}</h2>
      </div>
      <div className="cag-guide__step-body">{children}</div>
    </section>
  );
}

export default function InstallationPage() {
  return (
    <>
      <header>
        <h1 className="cag-page-title">Installation</h1>
        <p className="cag-page-desc">
          Connect your existing Liquid forms to the app proxy gateway. This app
          does not replace your forms — it receives their submissions securely.
        </p>
      </header>

      <div className="cag-guide">
        <section className="cag-guide__intro">
          <h2 className="cag-guide__h2">How it works</h2>
          <ol className="cag-guide__flow">
            <li>
              Customer submits a storefront form on your theme.
            </li>
            <li>
              <code>forms-gateway.js</code> uploads files through Shopify
              staging, then posts fields to{" "}
              <code>/apps/forms/submit</code> via the app proxy.
            </li>
            <li>
              Files appear in <strong>Content → Files</strong>. Submissions
              appear under <strong>Form submissions</strong> in this app.
            </li>
          </ol>
          <p className="cag-guide__note">
            Storefront paths: <code>/apps/forms/session</code>,{" "}
            <code>/apps/forms/staged-upload</code>,{" "}
            <code>/apps/forms/submit</code>. No Admin API secrets belong in the
            theme.
          </p>
        </section>

        <Step number="1" title="Add the gateway script to your theme">
          <p>
            Download the helper and upload it to your theme{" "}
            <code>assets/</code> folder (Online Store → Themes → Edit code →
            Assets → Add a new asset).
          </p>
          <p style={{ marginTop: 12 }}>
            <a
              className="cag-btn cag-btn--primary"
              href="/forms-gateway.js"
              download="forms-gateway.js"
              target="_blank"
              rel="noreferrer"
            >
              Download forms-gateway.js
            </a>
          </p>
          <p style={{ marginTop: 16 }}>
            Load it on any template that contains a gateway form (often{" "}
            <code>theme.liquid</code> before <code>&lt;/body&gt;</code>, or the
            specific page template):
          </p>
          <CodeBlock code={SCRIPT_TAG} label="Liquid" />
        </Step>

        <Step number="2" title="Mark each form">
          <p>
            Keep your existing fields. Add{" "}
            <code>data-forms-gateway</code> on the <code>&lt;form&gt;</code> and
            a hidden <code>form_key</code>. Use a unique key per form so you can
            filter submissions in admin (for example{" "}
            <code>install-quote</code>, <code>warranty-claim</code>,{" "}
            <code>contact-support</code>).
          </p>
          <CodeBlock code={FORM_EXAMPLE} label="Liquid form example" />
        </Step>

        <Step number="3" title="Form attributes">
          <div className="cag-guide__table-wrap">
            <table className="cag-guide__table">
              <thead>
                <tr>
                  <th scope="col">Attribute</th>
                  <th scope="col">Required</th>
                  <th scope="col">Effect</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>data-forms-gateway</code>
                  </td>
                  <td>Yes</td>
                  <td>Auto-binds the form when the page loads</td>
                </tr>
                <tr>
                  <td>
                    <code>name=&quot;form_key&quot;</code> (hidden input)
                  </td>
                  <td>Yes</td>
                  <td>Labels the submission in Form submissions</td>
                </tr>
                <tr>
                  <td>
                    <code>data-success-redirect</code>
                  </td>
                  <td>No</td>
                  <td>URL to open after a successful submit</td>
                </tr>
                <tr>
                  <td>
                    <code>data-no-reset</code>
                  </td>
                  <td>No</td>
                  <td>
                    Keep field values after success (ignored if redirect is set)
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>enctype=&quot;multipart/form-data&quot;</code>
                  </td>
                  <td>If files</td>
                  <td>Needed when the form includes file inputs</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Step>

        <Step number="4" title="What happens on submit">
          <ol className="cag-guide__list">
            <li>The script starts a short-lived secure gateway session.</li>
            <li>Non-file fields are collected into a JSON map.</li>
            <li>
              Each selected file requests a staged upload target, then uploads
              bytes to Shopify staging.
            </li>
            <li>
              The app creates Shopify Files and saves an app-owned metaobject
              submission.
            </li>
          </ol>
        </Step>

        <Step number="5" title="File limits">
          <ul className="cag-guide__list">
            <li>
              Images: <code>jpeg</code>, <code>png</code>, <code>webp</code>,{" "}
              <code>gif</code>
            </li>
            <li>
              Documents: <code>pdf</code>
            </li>
            <li>Max 20&nbsp;MB per file</li>
            <li>Max 10 files per submission</li>
          </ul>
        </Step>

        <Step number="6" title="Optional: success and error events">
          <p>
            Listen for custom events if you want toasts, analytics, or custom UI
            after submit:
          </p>
          <CodeBlock code={EVENTS_EXAMPLE} label="JavaScript" />
        </Step>

        <Step number="7" title="Optional: dynamically injected forms">
          <p>
            If the form is added to the page after load (AJAX / section
            rendering), bind it manually:
          </p>
          <CodeBlock code={BIND_EXAMPLE} label="JavaScript" />
        </Step>

        <section className="cag-guide__step">
          <div className="cag-guide__step-head">
            <span className="cag-guide__step-num" aria-hidden="true">
              ✓
            </span>
            <h2 className="cag-guide__step-title">Verify it works</h2>
          </div>
          <div className="cag-guide__step-body">
            <ul className="cag-guide__checklist">
              <li>App is installed with the required scopes</li>
              <li>
                <code>forms-gateway.js</code> loads on the page (check Network)
              </li>
              <li>
                Form has <code>data-forms-gateway</code> and a hidden{" "}
                <code>form_key</code>
              </li>
              <li>
                Text-only submit appears under Form submissions
              </li>
              <li>
                Image/PDF under 20&nbsp;MB appears in Content → Files and on the
                submission detail
              </li>
              <li>
                Unsupported types (e.g. <code>.exe</code>) show a clear error
              </li>
            </ul>
          </div>
        </section>

        <section className="cag-guide__step">
          <div className="cag-guide__step-head">
            <span className="cag-guide__step-num" aria-hidden="true">
              !
            </span>
            <h2 className="cag-guide__step-title">Troubleshooting</h2>
          </div>
          <div className="cag-guide__step-body">
            <div className="cag-guide__table-wrap">
              <table className="cag-guide__table">
                <thead>
                  <tr>
                    <th scope="col">Symptom</th>
                    <th scope="col">Likely fix</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>401 / session errors from the storefront</td>
                    <td>
                      Confirm the app is installed and you are testing on the
                      live shop domain (app proxy), not calling the app host
                      directly.
                    </td>
                  </tr>
                  <tr>
                    <td>Form submits the normal Shopify/theme way</td>
                    <td>
                      Ensure the script tag is present and{" "}
                      <code>data-forms-gateway</code> is on the form.
                    </td>
                  </tr>
                  <tr>
                    <td>Files missing after submit</td>
                    <td>
                      Check MIME type and size limits; confirm{" "}
                      <code>write_files</code> scope and Content → Files.
                    </td>
                  </tr>
                  <tr>
                    <td>Submission not in admin</td>
                    <td>
                      Confirm <code>form_key</code> is set and metaobject scopes
                      are granted (reinstall if needed).
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className="cag-guide__footer">
          <Link className="cag-btn cag-btn--accent" to="/app">
            View submissions
          </Link>
          <Link className="cag-btn" to="/app/help">
            Help & Support
          </Link>
        </div>
      </div>
    </>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
