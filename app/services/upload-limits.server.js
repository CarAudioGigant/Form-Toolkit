export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES_PER_SUBMIT = 10;
export const MAX_FIELD_KEYS = 100;
export const MAX_FIELD_VALUE_LENGTH = 10_000;
export const MAX_FORM_KEY_LENGTH = 100;

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export function isImageMimeType(mimeType) {
  return typeof mimeType === "string" && mimeType.startsWith("image/");
}

export function assertAllowedMimeType(mimeType) {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `Unsupported file type: ${mimeType}. Allowed: ${[...ALLOWED_MIME_TYPES].join(", ")}`,
    );
  }
}

export function assertFileSize(fileSize) {
  const size = Number(fileSize);
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("fileSize must be a positive number");
  }
  if (size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File exceeds max size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
    );
  }
  return size;
}
