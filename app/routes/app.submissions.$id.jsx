import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getSubmission } from "../services/submissions.server";

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const id = decodeURIComponent(params.id || "");
  const submission = await getSubmission(admin, id);

  if (!submission) {
    throw new Response("Submission not found", { status: 404 });
  }

  return { submission };
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

function formatBytes(size) {
  const n = Number(size) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType) {
  return typeof mimeType === "string" && mimeType.startsWith("image/");
}

export default function SubmissionDetail() {
  const { submission } = useLoaderData();
  const fieldEntries = Object.entries(submission.fields || {});

  return (
    <s-page heading={submission.formKey || "Submission"}>
      <s-link slot="breadcrumb-actions" href="/app">
        Submissions
      </s-link>
      <s-button slot="primary-action" variant="secondary" href="/app" icon="arrow-left">
        Back to list
      </s-button>

      <s-section heading="Overview">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))" gap="base">
          <s-box padding="base" border="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Submitted</s-text>
              <s-text type="strong">{formatDate(submission.createdAt)}</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" border="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Form key</s-text>
              <s-badge tone="info">{submission.formKey || "—"}</s-badge>
            </s-stack>
          </s-box>
          <s-box padding="base" border="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Fields</s-text>
              <s-badge>{fieldEntries.length}</s-badge>
            </s-stack>
          </s-box>
          <s-box padding="base" border="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Files</s-text>
              <s-badge tone={submission.files.length ? "success" : undefined}>
                {submission.files.length}
              </s-badge>
            </s-stack>
          </s-box>
          <s-box padding="base" border="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small">
              <s-text color="subdued">Customer</s-text>
              <s-text type="strong">
                {submission.customerId || "Guest"}
              </s-text>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      <s-section heading="Submitted fields">
        {fieldEntries.length === 0 ? (
          <s-box padding="base" border="base" borderRadius="base" background="subdued">
            <s-paragraph>No text fields were included with this submission.</s-paragraph>
          </s-box>
        ) : (
          <s-box padding="base" border="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              {fieldEntries.map(([key, value], index) => (
                <s-stack key={key} direction="block" gap="small">
                  <s-text color="subdued">{key}</s-text>
                  <s-text type="strong">{value || "—"}</s-text>
                  {index < fieldEntries.length - 1 ? <s-divider /> : null}
                </s-stack>
              ))}
            </s-stack>
          </s-box>
        )}
      </s-section>

      <s-section heading="Files">
        {submission.files.length === 0 ? (
          <s-box padding="base" border="base" borderRadius="base" background="subdued">
            <s-paragraph>No files were uploaded with this submission.</s-paragraph>
          </s-box>
        ) : (
          <s-grid
            gridTemplateColumns="repeat(auto-fill, minmax(200px, 1fr))"
            gap="base"
          >
            {submission.files.map((file, index) => (
              <s-box
                key={`${file.shopifyFileId || file.url || index}`}
                padding="base"
                border="base"
                borderRadius="base"
              >
                <s-stack direction="block" gap="base">
                  {isImage(file.mimeType) && file.url ? (
                    <s-thumbnail
                      size="large"
                      src={file.url}
                      alt={file.filename || "Uploaded image"}
                    />
                  ) : (
                    <s-box
                      padding="large"
                      background="subdued"
                      borderRadius="base"
                    >
                      <s-stack direction="block" gap="small" alignItems="center">
                        <s-icon type="file" />
                        <s-text color="subdued">
                          {file.mimeType || "File"}
                        </s-text>
                      </s-stack>
                    </s-box>
                  )}
                  <s-stack direction="block" gap="none">
                    <s-text type="strong">{file.filename || "Untitled"}</s-text>
                    <s-text color="subdued">
                      {file.fieldName || "file"} · {formatBytes(file.size)}
                    </s-text>
                  </s-stack>
                  {file.url ? (
                    <s-button
                      href={file.url}
                      target="_blank"
                      variant="secondary"
                      icon="external"
                    >
                      Open file
                    </s-button>
                  ) : (
                    <s-banner tone="warning">
                      File is still processing in Shopify Files.
                    </s-banner>
                  )}
                </s-stack>
              </s-box>
            ))}
          </s-grid>
        )}
      </s-section>

      <s-section heading="Technical details">
        <s-box padding="base" border="base" borderRadius="base" background="subdued">
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="none">
              <s-text color="subdued">Metaobject ID</s-text>
              <s-text>{submission.id}</s-text>
            </s-stack>
            {submission.ip ? (
              <s-stack direction="block" gap="none">
                <s-text color="subdued">IP</s-text>
                <s-text>{submission.ip}</s-text>
              </s-stack>
            ) : null}
            {submission.userAgent ? (
              <s-stack direction="block" gap="none">
                <s-text color="subdued">User agent</s-text>
                <s-text>{submission.userAgent}</s-text>
              </s-stack>
            ) : null}
          </s-stack>
        </s-box>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
