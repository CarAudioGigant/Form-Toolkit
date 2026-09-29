export function humanizeFormKey(formKey) {
  if (!formKey) return "Untitled form";
  return String(formKey)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function deriveSource(formKey) {
  const key = String(formKey || "").toLowerCase();
  if (key.includes("install")) return "Installation";
  if (key.includes("product") || key.includes("inquiry") || key.includes("quote")) {
    return "Product";
  }
  if (key.includes("contact") || key.includes("warranty") || key.includes("support")) {
    return "Contact";
  }
  const label = humanizeFormKey(formKey).split(" ")[0];
  return label || "Other";
}

export function sourceTone(source) {
  const value = String(source || "").toLowerCase();
  if (value.includes("install")) return "installation";
  if (value.includes("product")) return "product";
  if (value.includes("contact")) return "contact";
  return "other";
}

export function pickField(fields, keys) {
  if (!fields || typeof fields !== "object") return "";
  const entries = Object.entries(fields);
  for (const key of keys) {
    const exact = fields[key];
    if (typeof exact === "string" && exact.trim()) return exact.trim();
  }
  for (const key of keys) {
    const found = entries.find(
      ([k, v]) =>
        k.toLowerCase() === key && typeof v === "string" && v.trim(),
    );
    if (found) return found[1].trim();
  }
  for (const key of keys) {
    const found = entries.find(
      ([k, v]) =>
        k.toLowerCase().includes(key) && typeof v === "string" && v.trim(),
    );
    if (found) return found[1].trim();
  }
  return "";
}

export function extractName(fields) {
  const full = pickField(fields, [
    "name",
    "full_name",
    "fullname",
    "customer_name",
    "your_name",
  ]);
  if (full) return full;
  const first = pickField(fields, ["first_name", "voornaam", "firstname"]);
  const last = pickField(fields, ["last_name", "achternaam", "lastname"]);
  return [first, last].filter(Boolean).join(" ").trim();
}

export function extractEmail(fields) {
  return pickField(fields, [
    "email",
    "e-mail",
    "mail",
    "email_address",
    "e_mail",
  ]);
}

export function extractPhone(fields) {
  return pickField(fields, ["phone", "telephone", "tel", "mobiel", "mobile"]);
}

export function displaySubmissionId(submission) {
  const gidMatch = String(submission?.id || "").match(/Metaobject\/(\d+)/i);
  if (gidMatch) return gidMatch[1];
  const handleMatch = String(submission?.handle || "").match(/(\d+)$/);
  if (handleMatch) return handleMatch[1];
  return "—";
}

export function formatSubmittedAt(value) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  } catch {
    return String(value || "—");
  }
}

export function escapeText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildPageItems(current, totalPages) {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items = [1];
  const windowStart = Math.max(2, current - 1);
  const windowEnd = Math.min(totalPages - 1, current + 1);

  if (windowStart > 2) items.push("ellipsis-start");
  for (let page = windowStart; page <= windowEnd; page += 1) {
    items.push(page);
  }
  if (windowEnd < totalPages - 1) items.push("ellipsis-end");
  items.push(totalPages);
  return items;
}

export const DATE_PRESETS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "last90", label: "Last 90 days" },
];

export function resolveDateRange(preset, now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const startOfDay = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  switch (preset) {
    case "all":
      return { from: null, to: null };
    case "today":
      return { from: startOfDay(now), to: end };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: startOfDay(now) };
    }
    case "last7": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return { from, to: end };
    }
    case "last90": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 89);
      return { from, to: end };
    }
    case "last30":
    default: {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 29);
      return { from, to: end };
    }
  }
}
