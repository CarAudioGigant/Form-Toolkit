import { useLoaderData, Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { listSubmissions } from "../services/submissions.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");

  const { submissions, pagination } = await listSubmissions(admin, {
    cursor,
  });

  return { submissions, pagination };
};

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

export default function SubmissionsIndex() {
  const { submissions, pagination } = useLoaderData();

  return (
    <s-page heading="Form submissions">
      <s-section>
        <s-paragraph>
          Submissions stored as Shopify metaobjects (plus files in Content →
          Files).
        </s-paragraph>
      </s-section>

      <s-section heading="All submissions">
        {submissions.length === 0 ? (
          <s-box padding="base" border="base" borderRadius="base">
            <s-paragraph>
              No submissions yet. Wire a Liquid form to{" "}
              <code>/apps/forms/submit</code> using the forms gateway helper.
            </s-paragraph>
          </s-box>
        ) : (
          <s-box padding="base" border="base" borderRadius="base">
            <s-table>
              <s-table-header-row>
                <s-table-header>Form</s-table-header>
                <s-table-header>Submitted</s-table-header>
                <s-table-header>Fields</s-table-header>
                <s-table-header>Files</s-table-header>
                <s-table-header> </s-table-header>
              </s-table-header-row>
              <s-table-body>
                {submissions.map((submission) => (
                  <s-table-row key={submission.id}>
                    <s-table-cell>
                      <s-text type="strong">{submission.formKey}</s-text>
                    </s-table-cell>
                    <s-table-cell>{formatDate(submission.createdAt)}</s-table-cell>
                    <s-table-cell>{submission.fieldCount}</s-table-cell>
                    <s-table-cell>{submission.fileCount}</s-table-cell>
                    <s-table-cell>
                      <Link
                        to={`/app/submissions/${encodeURIComponent(submission.id)}`}
                      >
                        View
                      </Link>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          </s-box>
        )}
      </s-section>

      {pagination.hasNext ? (
        <s-section>
          <s-stack direction="inline" gap="base">
            <Link to={`/app?cursor=${encodeURIComponent(pagination.nextCursor)}`}>
              Next page
            </Link>
          </s-stack>
        </s-section>
      ) : null}
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
