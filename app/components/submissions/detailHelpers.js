import {
  extractEmail,
  extractName,
  extractPhone,
  formatSubmittedAt,
  humanizeFormKey,
  pickField,
} from "./helpers";

const CUSTOMER_KEY_GROUPS = {
  name: ["name", "full_name", "naam", "customer_name", "your_name", "first_name", "voornaam", "lastname", "last_name", "achternaam"],
  email: ["email", "e-mail", "mail", "email_address", "e_mail"],
  phone: ["phone", "telephone", "tel", "mobiel", "mobile", "phone_number"],
  company: ["company", "bedrijf", "organization", "organisation", "firma"],
  customerType: ["customer_type", "customer-type", "type_klant", "klanttype"],
  location: ["location", "city", "plaats", "stad", "address", "adres", "woonplaats"],
  language: ["language", "taal", "locale"],
};

const ALL_CUSTOMER_KEYS = new Set(
  Object.values(CUSTOMER_KEY_GROUPS).flatMap((keys) =>
    keys.map((key) => key.toLowerCase()),
  ),
);

function isCustomerKey(key) {
  const lower = String(key || "").toLowerCase();
  if (ALL_CUSTOMER_KEYS.has(lower)) return true;
  return [...ALL_CUSTOMER_KEYS].some(
    (candidate) => lower.includes(candidate) || candidate.includes(lower),
  );
}

export function extractCompany(fields) {
  return pickField(fields, CUSTOMER_KEY_GROUPS.company);
}

export function extractCustomerType(fields) {
  return pickField(fields, CUSTOMER_KEY_GROUPS.customerType);
}

export function extractLocation(fields) {
  return pickField(fields, CUSTOMER_KEY_GROUPS.location);
}

export function extractLanguage(fields) {
  return pickField(fields, CUSTOMER_KEY_GROUPS.language);
}

/**
 * Build customer rows — only include fields that have values.
 */
export function buildCustomerRows(submission) {
  const fields = submission?.fields || {};
  const rows = [
    { key: "name", label: "Name", value: submission.name || extractName(fields) },
    {
      key: "email",
      label: "Email",
      value: submission.email || extractEmail(fields),
      type: "email",
    },
    {
      key: "phone",
      label: "Phone",
      value: submission.phone || extractPhone(fields),
      type: "phone",
    },
    { key: "company", label: "Company", value: extractCompany(fields) },
    {
      key: "customerType",
      label: "Customer type",
      value: extractCustomerType(fields),
    },
    { key: "location", label: "Location", value: extractLocation(fields) },
    { key: "language", label: "Language", value: extractLanguage(fields) },
  ];

  return rows.filter((row) => Boolean(row.value));
}

function humanizeFieldKey(key) {
  return humanizeFormKey(key);
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function looksLikePhone(value) {
  const text = String(value || "").trim();
  return /^\+?[\d\s().-]{7,}$/.test(text) && /\d{6,}/.test(text.replace(/\D/g, ""));
}

function looksLikeUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function looksLikeDate(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(text) && !/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(text)) {
    return false;
  }
  const date = new Date(text);
  return !Number.isNaN(date.getTime());
}

function looksLikeMultiline(value) {
  const text = String(value || "");
  return text.includes("\n") || text.length > 160;
}

function normalizeListValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === "string" && value.includes(",")) {
    const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }
  return null;
}

/**
 * Infer a renderable field descriptor from a raw key/value pair.
 */
export function inferResponseField(key, value) {
  const lower = String(key || "").toLowerCase();
  const stringValue =
    value == null
      ? ""
      : typeof value === "string"
        ? value
        : Array.isArray(value)
          ? value.join(", ")
          : String(value);

  if (isCustomerKey(key)) {
    return null;
  }

  if (typeof value === "boolean" || /^(yes|no|true|false|ja|nee)$/i.test(stringValue.trim())) {
    const normalized = String(value === true || /^(yes|true|ja)$/i.test(stringValue.trim())
      ? "Yes"
      : value === false || /^(no|false|nee)$/i.test(stringValue.trim())
        ? "No"
        : stringValue);
    return {
      key,
      label: humanizeFieldKey(key),
      type: "checkbox",
      value: normalized,
    };
  }

  const list = normalizeListValue(value);
  if (list && list.length > 1) {
    return {
      key,
      label: humanizeFieldKey(key),
      type: "multiselect",
      value: list,
    };
  }

  if (lower.includes("email") || looksLikeEmail(stringValue)) {
    return {
      key,
      label: humanizeFieldKey(key),
      type: "email",
      value: stringValue,
    };
  }

  if (
    lower.includes("phone") ||
    lower.includes("tel") ||
    lower.includes("mobiel") ||
    looksLikePhone(stringValue)
  ) {
    return {
      key,
      label: humanizeFieldKey(key),
      type: "phone",
      value: stringValue,
    };
  }

  if (lower.includes("date") || lower.includes("datum") || looksLikeDate(stringValue)) {
    return {
      key,
      label: humanizeFieldKey(key),
      type: "date",
      value: stringValue,
    };
  }

  if (lower.includes("time") || lower.includes("tijd")) {
    return {
      key,
      label: humanizeFieldKey(key),
      type: "time",
      value: stringValue,
    };
  }

  if (lower.includes("url") || lower.includes("website") || looksLikeUrl(stringValue)) {
    return {
      key,
      label: humanizeFieldKey(key),
      type: "url",
      value: stringValue,
    };
  }

  if (
    lower.includes("message") ||
    lower.includes("bericht") ||
    lower.includes("notes") ||
    lower.includes("opmerking") ||
    lower.includes("comment") ||
    looksLikeMultiline(stringValue)
  ) {
    return {
      key,
      label: humanizeFieldKey(key),
      type: "textarea",
      value: stringValue,
    };
  }

  if (
    (typeof value === "number" || /^-?\d+(\.\d+)?$/.test(stringValue.trim())) &&
    !looksLikePhone(stringValue)
  ) {
    return {
      key,
      label: humanizeFieldKey(key),
      type: "number",
      value: stringValue,
    };
  }

  return {
    key,
    label: humanizeFieldKey(key),
    type: "text",
    value: stringValue,
  };
}

export function buildResponseFields(submission) {
  const fields = submission?.fields || {};
  return Object.entries(fields)
    .map(([key, value]) => inferResponseField(key, value))
    .filter(Boolean);
}

export function formatDetailTimestamp(value) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(new Date(value))
      .replace(",", " at");
  } catch {
    return formatSubmittedAt(value);
  }
}

export function formatBytes(size) {
  const n = Number(size) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageFile(file) {
  if (typeof file?.mimeType === "string" && file.mimeType.startsWith("image/")) {
    return true;
  }
  const name = String(file?.filename || "").toLowerCase();
  return /\.(jpe?g|png|gif|webp|svg)$/.test(name);
}
