/**
 * Checks and cleans what the dashboard sends, using the same validators as the Google Sheet pipeline
 * (scripts/lib/validate.mjs). The Sheet blanks a bad cell and reports it; the dashboard instead returns an
 * error for that field so the editor can fix it.
 */
import type { EntityDef, FieldDef } from "../shared/entities.ts";
import {
  contactEmail,
  linkedinUrl,
  normalizePhone,
  parseDate,
  parseList,
  photoUrl,
  safeUrl,
} from "../../scripts/lib/validate.mjs";

export type FieldErrors = Record<string, string>;
export type FieldValue = string | number | boolean | null;
export type Values = Record<string, FieldValue>;

// Control characters except tab and newline (matching them is the point of this pattern).
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanText(v: string, multiline = false): string {
  const s = v.replace(/\r\n?/g, "\n").replace(CONTROL, "");
  return multiline ? s.replace(/[ \t]+\n/g, "\n").trim() : s.replace(/\s+/g, " ").trim();
}

const DEFAULT_MAX = 200;

/** One field: returns the stored value, or an error message. */
function checkField(field: FieldDef, raw: unknown): { value: FieldValue } | { error: string } {
  if (raw === null || raw === undefined) raw = "";
  if (typeof raw !== "string") return { error: "must be text" };
  const text = cleanText(raw, field.kind === "longtext");
  const max = field.max ?? (field.kind === "longtext" ? 4000 : DEFAULT_MAX);
  if (text.length > max) return { error: `must be at most ${max} characters` };
  if (!text) {
    if (field.required) return { error: "is required" };
    return { value: field.kind === "date" ? null : "" };
  }
  switch (field.kind) {
    case "text":
    case "longtext":
      return { value: text };
    case "url":
      return safeUrl(text) ? { value: safeUrl(text) } : { error: "must be a full http(s):// link" };
    case "linkedin":
      return linkedinUrl(text)
        ? { value: linkedinUrl(text) }
        : { error: "must be an https:// link on linkedin.com" };
    case "email":
      return contactEmail(text)
        ? { value: contactEmail(text) }
        : { error: "is not an email address" };
    case "phone":
      return normalizePhone(text)
        ? { value: normalizePhone(text) }
        : { error: "use digits, spaces, dashes and an optional leading +" };
    case "photo":
      return photoUrl(text) ? { value: photoUrl(text) } : { error: "is not a usable image link" };
    case "date":
      return parseDate(text)
        ? { value: parseDate(text) }
        : { error: "is not a date (use YYYY-MM-DD)" };
    case "list":
      return { value: parseList(text).join("; ") };
  }
}

/**
 * Validates a create or update body. `existing` holds the current values for an update; fields missing from
 * the body keep those values, so the list page can send only { visible: false }.
 * Returns the full set of values (API field names) plus visible, order and, for alumni, consent.
 */
export function validateContent(
  def: EntityDef,
  body: unknown,
  existing?: Values,
): { values: Values; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const values: Values = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { values, errors: { _: "The request body must be a JSON object." } };
  }
  const input = body as Record<string, unknown>;
  const allowed = new Set([
    ...def.fields.map((f) => f.name),
    "visible",
    "order",
    ...(def.name === "alumni" ? ["consent"] : []),
  ]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) errors[key] = "is not a field of this section";
  }

  for (const field of def.fields) {
    const raw = field.name in input ? input[field.name] : existing?.[field.name];
    const result = checkField(field, raw);
    if ("error" in result) errors[field.name] = `${field.label} ${result.error}.`;
    else values[field.name] = result.value;
  }

  const flag = (name: string, fallback: boolean) => {
    const raw = name in input ? input[name] : (existing?.[name] ?? fallback);
    if (typeof raw !== "boolean") {
      errors[name] = `${name} must be true or false.`;
      return fallback;
    }
    return raw;
  };
  values.visible = flag("visible", def.name !== "alumni");
  if (def.name === "alumni") {
    values.consent = flag("consent", false);
    // Withdrawing consent (without saying anything about visibility) hides the person.
    if (input.consent === false && !("visible" in input)) values.visible = false;
  }

  const order = "order" in input ? input.order : (existing?.order ?? null);
  if (order === null || order === "") values.order = null;
  else if (typeof order === "number" && Number.isInteger(order) && Math.abs(order) <= 1_000_000)
    values.order = order;
  else errors.order = "Order must be a whole number (or empty).";

  if (def.name === "alumni" && values.visible === true && values.consent !== true) {
    errors.visible = "An alumnus can only be shown on the site after they have given consent.";
  }
  return { values, errors };
}
