import { redirect } from "react-router";
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

  // Prefer the list + drawer experience.
  return redirect(`/app?view=${encodeURIComponent(submission.id)}`);
};

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
