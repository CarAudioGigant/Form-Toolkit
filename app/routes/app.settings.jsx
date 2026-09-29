import { Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return {};
};

export default function SettingsPage() {
  return (
    <>
      <header>
        <h1 className="cag-page-title">Settings</h1>
        <p className="cag-page-desc">
          Configure how the Form Toolkit connects to your storefront forms.
        </p>
      </header>
      <section className="cag-placeholder-page">
        <p className="cag-page-desc">
          Settings will land here in a later release. For now, submissions are
          saved as Shopify metaobjects and uploaded files go to Content → Files.
        </p>
        <p style={{ marginTop: 16 }}>
          <Link className="cag-btn" to="/app">
            Back to submissions
          </Link>
        </p>
      </section>
    </>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
