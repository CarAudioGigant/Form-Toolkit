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

/**
 * Unwrap technical keys like Contact[Onderwerp] → Onderwerp
 */
export function unwrapFieldKey(key) {
  let current = String(key || "").trim();
  if (!current) return "";

  let match;
  while ((match = current.match(/^[^\[]+\[(.+)\]$/))) {
    current = match[1].trim();
  }

  current = current.replace(/^(contact|form|field)[_\-\s]+/i, "");
  return current.trim() || String(key).trim();
}

function normalizeKeyToken(key) {
  return unwrapFieldKey(key)
    .toLowerCase()
    .replace(/[\[\]_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCustomerKey(key) {
  const token = normalizeKeyToken(key);
  if (!token) return false;
  if (ALL_CUSTOMER_KEYS.has(token.replace(/\s+/g, "_"))) return true;
  if (ALL_CUSTOMER_KEYS.has(token)) return true;
  return [...ALL_CUSTOMER_KEYS].some((candidate) => {
    const c = candidate.replace(/_/g, " ");
    return token === c || token.endsWith(` ${c}`) || token.startsWith(`${c} `);
  });
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

export function buildCustomerRows(submission) {
  const fields = submission?.fields || {};
  const flattened = {};
  for (const [key, value] of Object.entries(fields)) {
    flattened[key] = value;
    flattened[unwrapFieldKey(key)] = value;
    flattened[normalizeKeyToken(key)] = value;
  }

  const rows = [
    {
      key: "name",
      label: "Name",
      value: submission.name || extractName(flattened) || extractName(fields),
    },
    {
      key: "email",
      label: "Email",
      value: submission.email || extractEmail(flattened) || extractEmail(fields),
      type: "email",
    },
    {
      key: "phone",
      label: "Phone",
      value: submission.phone || extractPhone(flattened) || extractPhone(fields),
      type: "phone",
    },
    {
      key: "company",
      label: "Company",
      value: extractCompany(flattened) || extractCompany(fields),
    },
    {
      key: "customerType",
      label: "Customer type",
      value: extractCustomerType(flattened) || extractCustomerType(fields),
    },
    {
      key: "location",
      label: "Location",
      value: extractLocation(flattened) || extractLocation(fields),
    },
    {
      key: "language",
      label: "Language",
      value: extractLanguage(flattened) || extractLanguage(fields),
    },
  ];

  return rows.filter((row) => Boolean(row.value));
}

export function humanizeFieldKey(key) {
  let label = unwrapFieldKey(key);
  label = label.replace(/^interesse\s+/i, "");
  label = label
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!label) return humanizeFormKey(key);

  if (label === label.toLowerCase() || label === label.toUpperCase()) {
    return humanizeFormKey(label);
  }
  return label;
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
  return text.includes("\n") || text.length > 120;
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

function isAffirmative(value) {
  if (value === true) return true;
  return /^(yes|true|ja|1|on|checked)$/i.test(String(value ?? "").trim());
}

function isNegative(value) {
  if (value === false) return true;
  return /^(no|false|nee|0|off)$/i.test(String(value ?? "").trim());
}

function isBooleanish(value) {
  return (
    typeof value === "boolean" ||
    /^(yes|no|true|false|ja|nee|1|0|on|off|checked)$/i.test(
      String(value ?? "").trim(),
    )
  );
}

export function inferResponseField(key, value) {
  const unwrapped = unwrapFieldKey(key);
  const lower = normalizeKeyToken(key);
  const stringValue =
    value == null
      ? ""
      : typeof value === "string"
        ? value
        : Array.isArray(value)
          ? value.join(", ")
          : String(value);

  if (!stringValue.trim() && value !== 0 && value !== false) {
    return null;
  }

  if (isCustomerKey(key) || isCustomerKey(unwrapped)) {
    return null;
  }

  if (isBooleanish(value) || isBooleanish(stringValue)) {
    if (isNegative(value) || isNegative(stringValue)) {
      return null;
    }
    if (isAffirmative(value) || isAffirmative(stringValue)) {
      return {
        key,
        label: humanizeFieldKey(key),
        type: "checkbox",
        value: "Yes",
      };
    }
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
    lower.includes("waar ben je naar") ||
    lower.includes("zoek") ||
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
  const inferred = Object.entries(fields)
    .map(([key, value]) => inferResponseField(key, value))
    .filter(Boolean);

  const result = [];
  let yesBuffer = [];

  const flushYes = () => {
    if (yesBuffer.length === 0) return;
    if (yesBuffer.length === 1) {
      result.push({
        ...yesBuffer[0],
        type: "checkbox",
        value: "Yes",
      });
    } else {
      result.push({
        key: `grouped-yes-${yesBuffer[0].key}`,
        label: "Selected options",
        type: "chips",
        value: yesBuffer.map((item) => item.label),
      });
    }
    yesBuffer = [];
  };

  for (const field of inferred) {
    if (field.type === "checkbox" && field.value === "Yes") {
      yesBuffer.push(field);
      continue;
    }
    flushYes();
    result.push(field);
  }
  flushYes();

  return result;
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
