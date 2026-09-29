import { useLoaderData, redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { SubmissionsPage } from "../components/submissions/SubmissionsPage";
import { authenticate } from "../shopify.server";
import {
  deleteSubmissions,
  getSubmission,
  listSubmissions,
} from "../services/submissions.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Number(url.searchParams.get("limit") || "10");
  const search = url.searchParams.get("q") || "";
  const formKey = url.searchParams.get("form") || "";
  const datePreset = url.searchParams.get("date") || "last30";
  const sort = url.searchParams.get("sort") || "submitted_at";
  const order = url.searchParams.get("order") || "desc";
  const viewId = url.searchParams.get("view") || "";

  try {
    const list = await listSubmissions(admin, {
      page,
      limit,
      search,
      formKey,
      datePreset,
      sort,
      order,
    });

    let selectedSubmission = null;
    if (viewId) {
      selectedSubmission = await getSubmission(admin, viewId);
    }

    return {
      ...list,
      selectedSubmission,
      error: null,
    };
  } catch (error) {
    console.error("Failed to load submissions", error);
    return {
      submissions: [],
      formKeys: [],
      totalAll: 0,
      filters: {
        search,
        formKey,
        datePreset,
        sort,
        order,
      },
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
        from: 0,
        to: 0,
        hasNext: false,
        hasPrev: false,
      },
      selectedSubmission: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "delete") {
    const ids = formData
      .getAll("ids")
      .map((value) => String(value))
      .filter(Boolean);
    await deleteSubmissions(admin, ids);
    const referer = request.headers.get("Referer");
    if (referer) {
      const url = new URL(referer);
      url.searchParams.delete("view");
      return redirect(`${url.pathname}${url.search}`);
    }
    return redirect("/app");
  }

  return Response.json({ ok: false, error: "Unknown intent" }, { status: 400 });
};

export default function SubmissionsIndex() {
  const data = useLoaderData();
  return (
    <SubmissionsPage
      submissions={data.submissions}
      pagination={data.pagination}
      filters={data.filters}
      formKeys={data.formKeys}
      totalAll={data.totalAll}
      selectedSubmission={data.selectedSubmission}
      error={data.error}
    />
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
