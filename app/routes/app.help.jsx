import { Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return {};
};

export default function HelpPage() {
  return (
    <>
      <header>
        <h1 className="cag-page-title">Help & Support</h1>
        <p className="cag-page-desc">
          Need help with the Form Toolkit gateway or admin?
        </p>
      </header>
      <section className="cag-placeholder-page">
        <p className="cag-page-desc">
          Contact your CarAudioGigant technical contact or InterQos support for
          installation and production issues.
        </p>
        <ul style={{ marginTop: 16, color: "#5C6480", lineHeight: 1.7 }}>
          <li>
            App proxy endpoints: <code>/apps/forms/session</code>,{" "}
            <code>/apps/forms/staged-upload</code>,{" "}
            <code>/apps/forms/submit</code>
          </li>
          <li>
            Production app:{" "}
            <code>https://caraudiogigant-form-toolkit.onrender.com</code>
          </li>
        </ul>
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
