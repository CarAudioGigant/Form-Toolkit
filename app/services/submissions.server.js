import prisma from "../db.server";
import { assertShopifyStagedResourceUrl } from "./installed-shop.server";
import {
  MAX_FIELD_KEYS,
  MAX_FIELD_VALUE_LENGTH,
  MAX_FORM_KEY_LENGTH,
  MAX_FILES_PER_SUBMIT,
  assertAllowedMimeType,
  assertFileSize,
} from "./upload-limits.server";

const PAGE_SIZE = 25;

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

export async function createSubmission({
  shop,
  formKey,
  fields,
  files,
  customerId,
  ip,
  userAgent,
}) {
  return prisma.formSubmission.create({
    data: {
      shop,
      formKey,
      fields: JSON.stringify(fields),
      customerId: customerId || null,
      ip: ip || null,
      userAgent: userAgent || null,
      files: {
        create: files.map((file) => ({
          fieldName: file.fieldName,
          filename: file.filename,
          mimeType: file.mimeType,
          size: file.size,
          shopifyFileId: file.shopifyFileId,
          url: file.url,
        })),
      },
    },
    include: { files: true },
  });
}

export async function listSubmissions(shop, { page = 1 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [total, submissions] = await Promise.all([
    prisma.formSubmission.count({ where: { shop } }),
    prisma.formSubmission.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        files: true,
        _count: { select: { files: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return {
    submissions,
    pagination: {
      page: safePage,
      pageSize: PAGE_SIZE,
      total,
      totalPages,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1,
    },
  };
}

export async function getSubmission(shop, id) {
  return prisma.formSubmission.findFirst({
    where: { id, shop },
    include: { files: true },
  });
}

export function parseSubmissionFields(submission) {
  try {
    const parsed = JSON.parse(submission.fields || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}
