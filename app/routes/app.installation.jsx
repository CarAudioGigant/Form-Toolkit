import { Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return {};
};

export default function InstallationPage() {
  return (
    <>
      <header>
        <h1 className="cag-page-title">Installation</h1>
        <p className="cag-page-desc">
          Wire existing Liquid forms to the app proxy gateway.
        </p>
      </header>
      <section className="cag-placeholder-page">
        <ol style={{ margin: 0, paddingLeft: 20, color: "#5C6480", lineHeight: 1.7 }}>
          <li>
            Copy <code>forms-gateway.js</code> into your theme{" "}
            <code>assets/</code> folder.
          </li>
          <li>
            Add <code>data-forms-gateway</code> and a hidden{" "}
            <code>form_key</code> to each storefront form.
          </li>
          <li>
            Submissions appear under Form submissions; files land in Shopify
            Files.
          </li>
        </ol>
        <p className="cag-page-desc" style={{ marginTop: 20 }}>
          Full details: <code>docs/API_IMPLEMENTATION_GUIDE.md</code> and{" "}
          <code>docs/liquid-form-example.md</code> in the project repo.
        </p>
        <p style={{ marginTop: 16 }}>
          <Link className="cag-btn cag-btn--primary" to="/app">
            View submissions
          </Link>
        </p>
      </section>
    </>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
