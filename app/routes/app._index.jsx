import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { listSubmissions } from "../services/submissions.server";

function encodeCursorStack(stack) {
  if (!stack?.length) return "";
  return Buffer.from(JSON.stringify(stack), "utf8").toString("base64url");
}

function decodeCursorStack(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(
      Buffer.from(String(value), "base64url").toString("utf8"),
    );
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const stack = decodeCursorStack(url.searchParams.get("stack"));
  const after = stack.length ? stack[stack.length - 1] : null;

  const { submissions, pagination } = await listSubmissions(admin, {
    cursor: after,
    pageIndex: stack.length,
  });

  const nextStack = pagination.nextCursor
    ? [...stack, pagination.nextCursor]
    : stack;
  const prevStack = stack.slice(0, -1);

  return {
    submissions,
    pagination: {
      ...pagination,
      stackParam: encodeCursorStack(stack),
      nextHref: pagination.hasNext
        ? `/app?stack=${encodeURIComponent(encodeCursorStack(nextStack))}`
        : null,
      prevHref: pagination.hasPrev
        ? prevStack.length
          ? `/app?stack=${encodeURIComponent(encodeCursorStack(prevStack))}`
          : "/app"
        : null,
    },
  };
};

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return String(value || "—");
  }
}

export default function SubmissionsIndex() {
  const { submissions, pagination } = useLoaderData();
  const rangeLabel =
    submissions.length === 0
      ? "No submissions on this page"
      : `Showing ${pagination.from}–${pagination.to} · Page ${pagination.pageNumber}`;

  return (
    <s-page heading="Form submissions">
      <s-button
        slot="primary-action"
        variant="secondary"
        href="/app"
        icon="refresh"
      >
        Refresh
      </s-button>

      <s-section>
        <s-paragraph>
          Storefront form submissions saved as Shopify metaobjects. Uploaded
          files live in Content → Files.
        </s-paragraph>
      </s-section>

      {submissions.length === 0 && !pagination.hasPrev ? (
        <s-section>
          <s-box padding="large" border="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="base" alignItems="center">
              <s-heading>No submissions yet</s-heading>
              <s-paragraph>
                When customers submit a Liquid form through the gateway, entries
                appear here automatically.
              </s-paragraph>
              <s-text color="subdued">
                Endpoint: <code>/apps/forms/submit</code>
              </s-text>
            </s-stack>
          </s-box>
        </s-section>
      ) : (
        <>
          <s-section padding="none">
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Form</s-table-header>
                <s-table-header>Submitted</s-table-header>
                <s-table-header>Fields</s-table-header>
                <s-table-header>Files</s-table-header>
                <s-table-header listSlot="secondary"> </s-table-header>
              </s-table-header-row>
              <s-table-body>
                {submissions.map((submission) => {
                  const viewId = `view-${submission.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
                  const href = `/app/submissions/${encodeURIComponent(submission.id)}`;
                  return (
                    <s-table-row key={submission.id} clickDelegate={viewId}>
                      <s-table-cell>
                        <s-stack direction="block" gap="none">
                          <s-text type="strong">
                            {submission.formKey || "Untitled form"}
                          </s-text>
                          {submission.customerId ? (
                            <s-text color="subdued">
                              Customer {submission.customerId}
                            </s-text>
                          ) : (
                            <s-text color="subdued">Guest</s-text>
                          )}
                        </s-stack>
                      </s-table-cell>
                      <s-table-cell>{formatDate(submission.createdAt)}</s-table-cell>
                      <s-table-cell>
                        <s-badge tone="info">
                          {submission.fieldCount} field
                          {submission.fieldCount === 1 ? "" : "s"}
                        </s-badge>
                      </s-table-cell>
                      <s-table-cell>
                        <s-badge
                          tone={submission.fileCount > 0 ? "success" : undefined}
                        >
                          {submission.fileCount} file
                          {submission.fileCount === 1 ? "" : "s"}
                        </s-badge>
                      </s-table-cell>
                      <s-table-cell>
                        <s-button
                          id={viewId}
                          href={href}
                          variant="tertiary"
                          icon="view"
                        >
                          View
                        </s-button>
                      </s-table-cell>
                    </s-table-row>
                  );
                })}
              </s-table-body>
            </s-table>
          </s-section>

          <s-section>
            <s-stack
              direction="inline"
              gap="base"
              justifyContent="space-between"
              alignItems="center"
            >
              <s-text color="subdued">{rangeLabel}</s-text>
              <s-stack direction="inline" gap="small">
                <s-button
                  variant="secondary"
                  href={pagination.prevHref || undefined}
                  disabled={!pagination.hasPrev}
                  icon="chevron-left"
                >
                  Previous
                </s-button>
                <s-button
                  variant="secondary"
                  href={pagination.nextHref || undefined}
                  disabled={!pagination.hasNext}
                  icon="chevron-right"
                >
                  Next
                </s-button>
              </s-stack>
            </s-stack>
          </s-section>
        </>
      )}
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
