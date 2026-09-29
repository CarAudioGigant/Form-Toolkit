import {
  deriveSource,
  displaySubmissionId,
  extractEmail,
  extractName,
  extractPhone,
  humanizeFormKey,
  resolveDateRange,
} from "../components/submissions/helpers";
import { assertShopifyStagedResourceUrl } from "./installed-shop.server";
import {
  MAX_FIELD_KEYS,
  MAX_FIELD_VALUE_LENGTH,
  MAX_FORM_KEY_LENGTH,
  MAX_FILES_PER_SUBMIT,
  assertAllowedMimeType,
  assertFileSize,
} from "./upload-limits.server";

/** App-owned metaobject type from shopify.app.toml `[metaobjects.app.form_submission]` */
export const FORM_SUBMISSION_TYPE = "$app:form_submission";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const MAX_SCAN = 500;
const SCAN_BATCH = 50;

const METAOBJECT_DELETE = `#graphql
  mutation MetaobjectDelete($id: ID!) {
    metaobjectDelete(id: $id) {
      deletedId
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const METAOBJECT_CREATE = `#graphql
  mutation MetaobjectCreate($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject {
        id
        handle
        type
        updatedAt
        fields {
          key
          value
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const METAOBJECTS_LIST = `#graphql
  query FormSubmissions($type: String!, $first: Int!, $after: String) {
    metaobjects(
      type: $type
      first: $first
      after: $after
      reverse: true
      sortKey: "updated_at"
    ) {
      edges {
        cursor
        node {
          id
          handle
          updatedAt
          fields {
            key
            value
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const METAOBJECT_GET = `#graphql
  query FormSubmission($id: ID!) {
    metaobject(id: $id) {
      id
      handle
      type
      updatedAt
      fields {
        key
        value
      }
    }
  }
`;

export function sanitizeFormKey(formKey) {
  if (!formKey || typeof formKey !== "string") {
    throw new Error("form_key is required");
  }
  const trimmed = formKey.trim().slice(0, MAX_FORM_KEY_LENGTH);
  if (!trimmed) {
    throw new Error("form_key is required");
  }
  return trimmed;
}

export function sanitizeFields(fields) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    throw new Error("fields must be an object");
  }

  const entries = Object.entries(fields);
  if (entries.length > MAX_FIELD_KEYS) {
    throw new Error(`Too many fields (max ${MAX_FIELD_KEYS})`);
  }

  /** @type {Record<string, string>} */
  const cleaned = {};
  for (const [key, value] of entries) {
    if (typeof key !== "string" || !key.trim()) continue;
    const safeKey = key.trim().slice(0, 200);
    if (safeKey === "form_key") continue;
    const stringValue =
      value == null ? "" : typeof value === "string" ? value : String(value);
    cleaned[safeKey] = stringValue.slice(0, MAX_FIELD_VALUE_LENGTH);
  }

  return cleaned;
}

export function sanitizeIncomingFiles(files) {
  if (!Array.isArray(files)) {
    throw new Error("files must be an array");
  }
  if (files.length > MAX_FILES_PER_SUBMIT) {
    throw new Error(`Too many files (max ${MAX_FILES_PER_SUBMIT})`);
  }

  return files.map((file, index) => {
    if (!file || typeof file !== "object") {
      throw new Error(`files[${index}] is invalid`);
    }
    const fieldName =
      typeof file.fieldName === "string" && file.fieldName.trim()
        ? file.fieldName.trim().slice(0, 200)
        : `file_${index}`;
    const filename =
      typeof file.filename === "string" && file.filename.trim()
        ? file.filename.trim().slice(0, 255)
        : "upload.bin";
    const mimeType = file.mimeType;
    assertAllowedMimeType(mimeType);
    const size = assertFileSize(file.size);
    let resourceUrl;
    try {
      resourceUrl = assertShopifyStagedResourceUrl(file.resourceUrl);
    } catch (error) {
      throw new Error(
        `files[${index}].resourceUrl: ${
          error instanceof Error ? error.message : "invalid"
        }`,
      );
    }
    return { fieldName, filename, mimeType, size, resourceUrl };
  });
}

function fieldsMap(metaobject) {
  /** @type {Record<string, string>} */
  const map = {};
  for (const field of metaobject?.fields || []) {
    if (field?.key) map[field.key] = field.value ?? "";
  }
  return map;
}

function parseJsonField(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function normalizeSubmission(metaobject) {
  if (!metaobject?.id) return null;
  const map = fieldsMap(metaobject);
  const fields = parseJsonField(map.fields_json, {});
  const files = parseJsonField(map.files_json, []);
  const safeFields =
    fields && typeof fields === "object" && !Array.isArray(fields)
      ? fields
      : {};
  const safeFiles = Array.isArray(files) ? files : [];
  const formKey = map.form_key || "";
  const name = extractName(safeFields);
  const email = extractEmail(safeFields);
  const phone = extractPhone(safeFields);
  const source = deriveSource(formKey);

  return {
    id: metaobject.id,
    handle: metaobject.handle,
    formKey,
    formName: humanizeFormKey(formKey),
    displayId: displaySubmissionId({ id: metaobject.id, handle: metaobject.handle }),
    createdAt: map.submitted_at || metaobject.updatedAt,
    customerId: map.customer_id || null,
    ip: map.ip || null,
    userAgent: map.user_agent || null,
    name,
    email,
    phone,
    source,
    fields: safeFields,
    files: safeFiles,
    fieldCount: Object.keys(safeFields).length,
    fileCount: safeFiles.length,
  };
}

async function fetchSubmissionBatch(admin, { after = null, first = SCAN_BATCH } = {}) {
  const response = await admin.graphql(METAOBJECTS_LIST, {
    variables: {
      type: FORM_SUBMISSION_TYPE,
      first,
      after,
    },
  });
  const json = await response.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  const connection = json.data?.metaobjects;
  return {
    edges: connection?.edges || [],
    pageInfo: connection?.pageInfo || {},
  };
}

async function scanSubmissions(admin, { max = MAX_SCAN } = {}) {
  /** @type {ReturnType<typeof normalizeSubmission>[]} */
  const submissions = [];
  let after = null;
  let hasNext = true;

  while (hasNext && submissions.length < max) {
    const remaining = max - submissions.length;
    const { edges, pageInfo } = await fetchSubmissionBatch(admin, {
      after,
      first: Math.min(SCAN_BATCH, remaining),
    });
    for (const edge of edges) {
      const normalized = normalizeSubmission(edge.node);
      if (normalized) submissions.push(normalized);
    }
    hasNext = Boolean(pageInfo.hasNextPage);
    after = pageInfo.endCursor || null;
    if (!edges.length) break;
  }

  return { submissions, truncated: hasNext };
}

function matchesSearch(submission, search) {
  if (!search) return true;
  const q = search.toLowerCase();
  const haystacks = [
    submission.displayId,
    submission.formKey,
    submission.formName,
    submission.name,
    submission.email,
    submission.source,
    submission.phone,
    ...Object.values(submission.fields || {}),
  ];
  return haystacks.some((value) =>
    String(value || "")
      .toLowerCase()
      .includes(q),
  );
}

function matchesFilters(submission, { search, formKey, dateFrom, dateTo }) {
  if (!matchesSearch(submission, search)) return false;
  if (formKey && submission.formKey !== formKey) return false;
  const created = new Date(submission.createdAt).getTime();
  if (Number.isNaN(created)) return false;
  if (dateFrom && created < dateFrom.getTime()) return false;
  if (dateTo && created > dateTo.getTime()) return false;
  return true;
}

function sortSubmissions(submissions, sort, order) {
  const dir = order === "asc" ? 1 : -1;
  const sorted = [...submissions];
  sorted.sort((a, b) => {
    let left;
    let right;
    if (sort === "name") {
      left = (a.name || "").toLowerCase();
      right = (b.name || "").toLowerCase();
    } else if (sort === "form") {
      left = (a.formName || "").toLowerCase();
      right = (b.formName || "").toLowerCase();
    } else {
      left = new Date(a.createdAt).getTime();
      right = new Date(b.createdAt).getTime();
    }
    if (left < right) return -1 * dir;
    if (left > right) return 1 * dir;
    return 0;
  });
  return sorted;
}

/**
 * Persist a submission as an app-owned Shopify metaobject.
 * @param {import("@shopify/shopify-app-react-router/server").AdminApiContext} admin
 */
export async function createSubmission(admin, {
  formKey,
  fields,
  files,
  customerId,
  ip,
  userAgent,
}) {
  const submittedAt = new Date().toISOString();
  const response = await admin.graphql(METAOBJECT_CREATE, {
    variables: {
      metaobject: {
        type: FORM_SUBMISSION_TYPE,
        fields: [
          { key: "form_key", value: formKey },
          { key: "fields_json", value: JSON.stringify(fields) },
          { key: "files_json", value: JSON.stringify(files) },
          { key: "customer_id", value: customerId || "" },
          { key: "submitted_at", value: submittedAt },
          { key: "ip", value: ip || "" },
          { key: "user_agent", value: (userAgent || "").slice(0, 500) },
        ],
      },
    },
  });

  const json = await response.json();
  const payload = json.data?.metaobjectCreate;
  const errors = payload?.userErrors;
  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join("; "));
  }

  const metaobject = payload?.metaobject;
  if (!metaobject?.id) {
    throw new Error("metaobjectCreate did not return a metaobject");
  }

  return normalizeSubmission(metaobject);
}

/**
 * @param {import("@shopify/shopify-app-react-router/server").AdminApiContext} admin
 */
export async function listSubmissions(
  admin,
  {
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    search = "",
    formKey = "",
    datePreset = "last30",
    sort = "submitted_at",
    order = "desc",
  } = {},
) {
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(limit) || DEFAULT_PAGE_SIZE),
  );
  const pageNumber = Math.max(1, Number(page) || 1);
  const { from: dateFrom, to: dateTo } = resolveDateRange(datePreset);
  const cleanedSearch = String(search || "").trim().slice(0, 200);
  const cleanedFormKey = String(formKey || "").trim();

  const { submissions: scanned, truncated } = await scanSubmissions(admin);
  const formKeys = [
    ...new Set(
      scanned.map((item) => item.formKey).filter((value) => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const filtered = scanned.filter((submission) =>
    matchesFilters(submission, {
      search: cleanedSearch,
      formKey: cleanedFormKey,
      dateFrom,
      dateTo,
    }),
  );
  const sorted = sortSubmissions(filtered, sort, order);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(pageNumber, totalPages);
  const start = (safePage - 1) * pageSize;
  const submissions = sorted.slice(start, start + pageSize);
  const from = total === 0 ? 0 : start + 1;
  const to = start + submissions.length;

  return {
    submissions,
    formKeys,
    filters: {
      search: cleanedSearch,
      formKey: cleanedFormKey,
      datePreset,
      sort,
      order,
    },
    pagination: {
      page: safePage,
      limit: pageSize,
      total,
      totalPages,
      from,
      to,
      truncated,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1,
    },
  };
}

/**
 * @param {import("@shopify/shopify-app-react-router/server").AdminApiContext} admin
 */
export async function deleteSubmission(admin, id) {
  if (!id || typeof id !== "string") {
    throw new Error("Submission id is required");
  }

  const response = await admin.graphql(METAOBJECT_DELETE, {
    variables: { id },
  });
  const json = await response.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  const payload = json.data?.metaobjectDelete;
  const errors = payload?.userErrors;
  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join("; "));
  }
  if (!payload?.deletedId) {
    throw new Error("Failed to delete submission");
  }
  return payload.deletedId;
}

/**
 * @param {import("@shopify/shopify-app-react-router/server").AdminApiContext} admin
 */
export async function deleteSubmissions(admin, ids) {
  const unique = [...new Set((ids || []).filter((id) => typeof id === "string"))];
  const deleted = [];
  for (const id of unique) {
    deleted.push(await deleteSubmission(admin, id));
  }
  return deleted;
}

/**
 * @param {import("@shopify/shopify-app-react-router/server").AdminApiContext} admin
 */
export async function getSubmission(admin, id) {
  if (!id || typeof id !== "string") return null;

  const response = await admin.graphql(METAOBJECT_GET, {
    variables: { id },
  });
  const json = await response.json();
  const metaobject = json.data?.metaobject;
  if (!metaobject || metaobject.type !== FORM_SUBMISSION_TYPE) {
    // type may be returned as app--xxx--form_submission in some API versions
    if (!metaobject?.id) return null;
    if (
      metaobject.type &&
      !String(metaobject.type).includes("form_submission")
    ) {
      return null;
    }
  }
  return normalizeSubmission(metaobject);
}

export function parseSubmissionFields(submission) {
  return submission?.fields && typeof submission.fields === "object"
    ? submission.fields
    : {};
}
