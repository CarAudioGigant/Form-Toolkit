import { useLoaderData, Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  getSubmission,
  parseSubmissionFields,
} from "../services/submissions.server";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const submission = await getSubmission(session.shop, params.id);

  if (!submission) {
    throw new Response("Submission not found", { status: 404 });
  }

  return {
    submission: {
      id: submission.id,
      formKey: submission.formKey,
      createdAt: submission.createdAt,
      customerId: submission.customerId,
      fields: parseSubmissionFields(submission),
      files: submission.files.map((file) => ({
        id: file.id,
        fieldName: file.fieldName,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        url: file.url,
        shopifyFileId: file.shopifyFileId,
      })),
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
    return String(value);
  }
}

function formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType) {
  return typeof mimeType === "string" && mimeType.startsWith("image/");
}

export default function SubmissionDetail() {
  const { submission } = useLoaderData();
  const fieldEntries = Object.entries(submission.fields || {});

  return (
    <s-page heading={submission.formKey}>
      <s-link slot="breadcrumb-actions" href="/app">
        Submissions
      </s-link>

      <s-section heading="Details">
        <s-stack direction="block" gap="base">
          <s-text>
            <s-text type="strong">Submitted:</s-text>{" "}
            {formatDate(submission.createdAt)}
          </s-text>
          {submission.customerId ? (
            <s-text>
              <s-text type="strong">Customer ID:</s-text> {submission.customerId}
            </s-text>
          ) : null}
          <s-text>
            <s-text type="strong">Submission ID:</s-text> {submission.id}
          </s-text>
        </s-stack>
      </s-section>

      <s-section heading="Fields">
        {fieldEntries.length === 0 ? (
          <s-paragraph>No text fields were submitted.</s-paragraph>
        ) : (
          <s-box padding="base" border="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              {fieldEntries.map(([key, value]) => (
                <s-stack key={key} direction="block" gap="none">
                  <s-text type="strong">{key}</s-text>
                  <s-text>{value || "—"}</s-text>
                </s-stack>
              ))}
            </s-stack>
          </s-box>
        )}
      </s-section>

      <s-section heading="Files">
        {submission.files.length === 0 ? (
          <s-paragraph>No files were uploaded.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {submission.files.map((file) => (
              <s-box
                key={file.id}
                padding="base"
                border="base"
                borderRadius="base"
              >
                <s-stack direction="block" gap="base">
                  <s-text type="strong">
                    {file.fieldName}: {file.filename}
                  </s-text>
                  <s-text>
                    {file.mimeType} · {formatBytes(file.size)}
                  </s-text>
                  {isImage(file.mimeType) && file.url ? (
                    <s-box>
                      <img
                        src={file.url}
                        alt={file.filename}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "240px",
                          objectFit: "contain",
                        }}
                      />
                    </s-box>
                  ) : null}
                  {file.url ? (
                    <s-link href={file.url} target="_blank">
                      Open file
                    </s-link>
                  ) : (
                    <s-text>File URL not ready yet (still processing).</s-text>
                  )}
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>

      <s-section>
        <Link to="/app">Back to submissions</Link>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
