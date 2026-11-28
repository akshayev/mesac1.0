// Field validators shared by the Google Sheet pipeline (scripts/lib/sheet.mjs) and the admin server
// (src/server/*). Pure functions with no Node or browser APIs, so they run in Node, Vite and Workers alike.
// Types: validate.d.mts.

export const FALSE_WORDS = new Set(["false", "no", "n", "0", "hidden", "hide", "off"]);

/** Empty means visible; FALSE / no / 0 / hidden hide the row. */
export function parseVisible(v) {
  return !FALSE_WORDS.has(
    String(v ?? "")
      .trim()
      .toLowerCase(),
  );
}

/** Consent must be explicit: only TRUE / yes / 1 count. Empty or anything else means no consent. */
export function parseConsent(v) {
  return ["true", "yes", "1"].includes(
    String(v ?? "")
      .trim()
      .toLowerCase(),
  );
}

export const squash = (v) =>
  String(v ?? "")
    .trim()
    .replace(/\s+/g, " ");

/** "a; b;; A" -> ["A", "B"]: semicolon list, trimmed, first letter capitalised, no repeats. */
export function parseList(v) {
  const seen = new Map();
  for (const part of String(v ?? "").split(";")) {
    const s = squash(part);
    if (s && !seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s[0].toUpperCase() + s.slice(1));
  }
  return [...seen.values()];
}

/**
 * Phone cell -> "+<country code><number>" or "". Only digits, spaces, dashes and one leading + are
 * accepted. A 10-digit Indian number (also written with a leading 0 or 91) becomes +91XXXXXXXXXX.
 */
export function normalizePhone(v) {
  const s = String(v ?? "").trim();
  if (!/^\+?[\d -]+$/.test(s)) return "";
  const digits = s.replace(/\D/g, "");
  if (s.startsWith("+")) {
    if (digits.startsWith("91")) return digits.length === 12 ? `+${digits}` : "";
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : "";
  }
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return "";
}

export function parseOrder(v) {
  const n = Number(String(v ?? "").trim());
  return String(v ?? "").trim() !== "" && Number.isFinite(n) ? n : null;
}

/** http(s) URLs only. Anything else (javascript:, data:, bare text) returns "". */
export function safeUrl(v) {
  const s = String(v ?? "").trim();
  if (!/^https?:\/\//i.test(s)) return "";
  try {
    return new URL(s).toString();
  } catch {
    return "";
  }
}

/**
 * https links on linkedin.com or a subdomain of it, without a user name or password; otherwise "".
 * The hostname is compared after parsing, so linkedin.com.evil.com and evil.com/linkedin.com fail.
 */
export function linkedinUrl(v) {
  const s = String(v ?? "").trim();
  if (!/^https:\/\//i.test(s)) return "";
  let url;
  try {
    url = new URL(s);
  } catch {
    return "";
  }
  if (url.username || url.password) return "";
  const { hostname } = url;
  return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com") ? url.toString() : "";
}

export function safeEmail(v) {
  const s = String(v ?? "").trim();
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(s) ? s : "";
}

/**
 * Strict email for admin accounts (and ADMIN_BOOTSTRAP_EMAILS): lowercased, letters, digits and . _ % + -
 * before the @, a dotted domain after it. Anything else (quotes, spaces, commas, several @) returns "".
 */
export function strictEmail(v) {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (s.length > 254) return "";
  return /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(s) ? s : "";
}

/** An email that is safe inside a mailto: link: ? & # % would let a value add hidden fields (bcc, body). */
export function contactEmail(v) {
  return /[?&#%]/.test(String(v ?? "")) ? "" : safeEmail(v);
}

/** Path of a photo uploaded through the admin dashboard (served by the Worker from R2). */
export const MEDIA_PATH = /^\/media\/[0-9a-f]{32}\.(webp|jpg|png)$/;

const DRIVE_ID = /^[A-Za-z0-9_-]{20,}$/;
export const driveThumb = (id) => `https://drive.google.com/thumbnail?id=${id}&sz=w600`;

/**
 * Photo cell -> URL the browser can load, or "" (UI then shows an initials avatar).
 *  - https://drive.google.com/file/d/<id>/view, open?id=<id>, uc?id=<id>, or a bare Drive id -> thumbnail URL
 *  - any other http(s) URL -> unchanged
 *  - people/x.jpg, /people/x.jpg or x.jpg -> /people/x.jpg (files live in public/people/)
 *  - /media/<32 hex>.webp|jpg|png -> unchanged (photos uploaded through the admin dashboard, stored in R2)
 *  - anything else -> ""
 */
export function photoUrl(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (MEDIA_PATH.test(s)) return s;

  if (/^https?:\/\//i.test(s)) {
    const url = safeUrl(s);
    if (!url) return "";
    const u = new URL(url);
    if (/(^|\.)drive\.google\.com$/.test(u.hostname)) {
      const m = /\/file\/d\/([^/]+)/.exec(u.pathname);
      const id = m?.[1] ?? u.searchParams.get("id");
      if (id && DRIVE_ID.test(id)) return driveThumb(id);
    }
    return url;
  }

  if (DRIVE_ID.test(s) && !s.includes(".")) return driveThumb(s);

  const file = s.replace(/^\/+/, "").replace(/^people\//i, "");
  if (/^[\w][\w .()-]*\.(jpe?g|png|webp|gif|avif|svg)$/i.test(file)) {
    return `/people/${encodeURI(file)}`;
  }
  return "";
}

/**
 * Date cell -> "YYYY-MM-DD" or null. Accepts ISO (2025-03-14), DD/MM/YYYY or DD-MM-YYYY (Indian order),
 * and anything Date.parse understands with an explicit year ("14 Mar 2025", "March 2025").
 */
export function parseDate(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const valid = (y, m, d) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
      ? `${y}-${pad(m)}-${pad(d)}`
      : null;
  };
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return valid(+m[3], +m[2], +m[1]);
  if (/\b\d{4}\b/.test(s)) {
    const t = Date.parse(`${s} UTC`);
    if (!Number.isNaN(t)) {
      const dt = new Date(t);
      return valid(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    }
  }
  return null;
}

/**
 * Returns same(kind, value): the first spelling seen for a value (case-insensitive) within a kind, so
 * "referrals" and "Referrals" become one filter option.
 */
export function spellingUnifier() {
  const spellings = new Map();
  return (kind, value) => {
    const key = `${kind}:${String(value).toLowerCase()}`;
    if (!spellings.has(key)) spellings.set(key, value);
    return spellings.get(key);
  };
}

/** Keys the site reads from the settings tab. Anything else is reported but kept out of the snapshot. */
export const SETTING_KEYS = {
  hero_title: "text",
  hero_subtitle: "text",
  stat_members: "text",
  stat_members_label: "text",
  stat_papers: "text",
  stat_papers_label: "text",
  stat_placements: "text",
  stat_placements_label: "text",
  contact_email: "email",
  contact_phone: "text",
  instagram_url: "url",
  linkedin_url: "url",
  report_form_url: "url",
  report_form_file_entry: "text",
  placement_brochure_url: "url",
  announcement_text: "text",
  announcement_link: "link",
  footer_text: "text",
};

/**
 * Why a settings value is not acceptable for a known key, or "" when it is fine.
 * "email" -> an email; "url" -> an http(s) link; "link" -> an http(s) link or a /path on this site.
 */
export function settingProblem(key, value) {
  const kind = SETTING_KEYS[key];
  if (!kind) return "is not a known setting";
  if (kind === "email" && !safeEmail(value)) return "is not an email";
  if (kind === "url" && !safeUrl(value)) return "is not an http(s) link";
  if (kind === "link" && !safeUrl(value) && !/^\/[^/]/.test(value))
    return "must be an http(s) link or a /path";
  return "";
}

/** CF_ACCESS_TEAM_DOMAIN may be "mesac", "mesac.cloudflareaccess.com" or "https://mesac.cloudflareaccess.com/". */
export function normalizeTeamDomain(raw) {
  let s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https:\/\//, "")
    .replace(/\/+$/, "");
  if (/^[a-z0-9-]+$/.test(s)) s = `${s}.cloudflareaccess.com`;
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(s) ? s : "";
}

/** The Access application's Audience (AUD) tag: 64 hex characters. */
export function accessAud(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return /^[0-9a-f]{64}$/.test(s) ? s : "";
}
