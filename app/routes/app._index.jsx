import { useLoaderData, Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  listSubmissions,
  parseSubmissionFields,
} from "../services/submissions.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");

  const { submissions, pagination } = await listSubmissions(session.shop, {
    page,
  });

  return {
    submissions: submissions.map((submission) => {
      const fields = parseSubmissionFields(submission);
      return {
        id: submission.id,
        formKey: submission.formKey,
        createdAt: submission.createdAt,
        fieldCount: Object.keys(fields).length,
        fileCount: submission._count?.files ?? submission.files?.length ?? 0,
      };
    }),
    pagination,
  };
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
          Submissions from storefront Liquid forms via the app proxy gateway.
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
                      <Link to={`/app/submissions/${submission.id}`}>
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

      {pagination.total > 0 && (
        <s-section>
          <s-stack direction="inline" gap="base">
            <s-text>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total}{" "}
              total)
            </s-text>
            {pagination.hasPrev ? (
              <Link to={`/app?page=${pagination.page - 1}`}>Previous</Link>
            ) : null}
            {pagination.hasNext ? (
              <Link to={`/app?page=${pagination.page + 1}`}>Next</Link>
            ) : null}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
