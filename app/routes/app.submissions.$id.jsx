import { Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  CustomerInfoCard,
  FormResponsesCard,
  SubmissionDetailsCard,
} from "../components/submissions/SubmissionDetail";
import {
  buildCustomerRows,
  buildResponseFields,
  formatDetailTimestamp,
} from "../components/submissions/detailHelpers";
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

export default function SubmissionDetailPage() {
  const { submission } = useLoaderData();
  const customerRows = buildCustomerRows(submission);
  const responseFields = buildResponseFields(submission);

  return (
    <div className="cag-detail">
      <Link className="cag-back" to="/app">
        ← Back to submissions
      </Link>

      <header className="cag-detail__header">
        <div>
          <h1 className="cag-page-title">
            Submission #{submission.displayId}
          </h1>
          <p className="cag-page-desc">
            {submission.formName} · {formatDetailTimestamp(submission.createdAt)}
          </p>
        </div>
      </header>

      <div className="cag-detail__top">
        <CustomerInfoCard rows={customerRows} />
        <SubmissionDetailsCard submission={submission} />
      </div>

      <FormResponsesCard fields={responseFields} files={submission.files} />
    </div>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
