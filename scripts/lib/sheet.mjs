// Validation and normalisation of Google Sheet rows. Pure functions (tested in scripts/tests/sheet.test.mjs).
// Every normaliser returns { items, issues } and never throws on bad data: a bad row is skipped (or a bad
// field blanked) and described in `issues`, which ends up in data/sheet-report.md.

import { parseCsvObjects } from "./csv.mjs";

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

const squash = (v) =>
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

const DRIVE_ID = /^[A-Za-z0-9_-]{20,}$/;
export const driveThumb = (id) => `https://drive.google.com/thumbnail?id=${id}&sz=w600`;

/**
 * Photo cell -> URL the browser can load, or "" (UI then shows an initials avatar).
 *  - https://drive.google.com/file/d/<id>/view, open?id=<id>, uc?id=<id>, or a bare Drive id -> thumbnail URL
 *  - any other http(s) URL -> unchanged
 *  - people/x.jpg, /people/x.jpg or x.jpg -> /people/x.jpg (files live in public/people/)
 *  - anything else -> ""
 */
export function photoUrl(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";

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

const byOrderThen = (secondary) => (a, b) => {
  const ao = a.order ?? Number.POSITIVE_INFINITY;
  const bo = b.order ?? Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao < bo ? -1 : 1;
  return secondary(a, b);
};
const byName = (key) => (a, b) => a[key].localeCompare(b[key], "en", { sensitivity: "base" });

/**
 * Shared row loop: visibility, required field, order. Returns normalised items plus issues.
 * `redact` keeps cell values out of the issues (for tabs holding personal contact details).
 */
function normalizeRows(
  text,
  tab,
  requiredKey,
  build,
  requiredLabels = [requiredKey],
  { redact = false } = {},
) {
  const { headers, rows } = parseCsvObjects(text);
  const issues = [];
  const items = [];
  const need = new Set(requiredLabels);
  for (const h of need) {
    if (rows.length > 0 && !headers.includes(h))
      issues.push({ tab, line: 1, level: "error", message: `missing column "${h}"` });
  }
  for (const row of rows) {
    const note = (message, level = "warn") => issues.push({ tab, line: row._line, level, message });
    if (!parseVisible(row.visible)) {
      continue;
    }
    if (!row[requiredKey]) {
      note(`skipped: empty ${requiredKey}`);
      continue;
    }
    const orderRaw = row.order;
    const order = parseOrder(orderRaw);
    if (orderRaw && order === null) {
      note(`order ${redact ? "" : `"${orderRaw}" `}is not a number; sorted last`);
    }
    const item = build(row, note);
    if (item === null) continue;
    items.push({ ...item, order });
  }
  return { items, issues };
}

function cleanPhoto(row, field, note, { redact = false } = {}) {
  const raw = row[field];
  if (!raw) return "";
  const url = photoUrl(raw);
  if (!url) {
    const value = redact ? "" : `"${raw.slice(0, 60)}" `;
    note(`${field} ${value}is not a usable image; initials will be shown`);
  }
  return url;
}

function cleanLink(row, field, note) {
  const raw = row[field];
  if (!raw) return "";
  const url = safeUrl(raw);
  if (!url) note(`${field} "${raw.slice(0, 60)}" is not an http(s) link; ignored`);
  return url;
}

export function normalizeTeam(text) {
  const { items, issues } = normalizeRows(text, "team", "name", (row, note) => {
    const email = safeEmail(row.email_public);
    if (row.email_public && !email) {
      note(`email_public "${row.email_public.slice(0, 60)}" is not an email; ignored`);
    }
    return {
      name: row.name,
      role: row.role ?? "",
      group: row.group || "Team",
      photo: cleanPhoto(row, "photo", note),
      linkedin: cleanLink(row, "linkedin", note),
      email,
    };
  });
  items.sort(byOrderThen(byName("name")));
  return { items, issues };
}

export function normalizeAchievements(text) {
  const { items, issues } = normalizeRows(text, "achievements", "title", (row, note) => {
    let date = null;
    if (row.date) {
      date = parseDate(row.date);
      if (!date) note(`date "${row.date.slice(0, 40)}" not understood; shown without a date`);
    }
    return {
      title: row.title,
      date,
      category: row.category ?? "",
      description: row.description ?? "",
      image: cleanPhoto(row, "image", note),
      link: cleanLink(row, "link", note),
    };
  });
  items.sort(
    byOrderThen((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || byName("title")(a, b)),
  );
  return { items, issues };
}

export function normalizePlacements(text) {
  const { items, issues } = normalizeRows(
    text,
    "placements",
    "name",
    (row, note) => {
      if (!row.company) {
        note("skipped: empty company");
        return null;
      }
      return {
        name: row.name,
        company: row.company,
        role: row.role ?? "",
        batch: row.batch ?? "",
        photo: cleanPhoto(row, "photo", note),
        linkedin: cleanLink(row, "linkedin", note),
      };
    },
    ["name", "company"],
  );
  items.sort(byOrderThen(byName("name")));
  return { items, issues };
}

/**
 * Alumni are published only with consent. This tab holds phone numbers and emails and the report is a
 * public CI artifact, so its issues name the column and row only, never the cell value.
 */
export function normalizeAlumni(text) {
  let skippedNoConsent = 0;
  // One spelling per value ("referrals" and "Referrals" are one filter option): the first one wins.
  const spellings = new Map();
  const same = (kind, value) => {
    const key = `${kind}:${value.toLowerCase()}`;
    if (!spellings.has(key)) spellings.set(key, value);
    return spellings.get(key);
  };
  const { items, issues } = normalizeRows(
    text,
    "alumni",
    "name",
    (row, note) => {
      if (!parseConsent(row.consent)) {
        skippedNoConsent += 1;
        note("skipped: no consent");
        return null;
      }
      const checked = (field, clean, problem) => {
        const value = clean(row[field]);
        if (row[field] && !value) note(`${field} ${problem}; ignored`);
        return value;
      };
      return {
        name: row.name,
        batch: same("batch", squash(row.batch)),
        department: same("department", squash(row.department)),
        currentRole: row.current_role ?? "",
        company: row.company ?? "",
        location: row.location ?? "",
        photo: cleanPhoto(row, "photo", note, { redact: true }),
        linkedin: checked("linkedin", linkedinUrl, "is not a linkedin.com https link"),
        // ? & # % would let a cell add hidden fields (bcc, body) to the mailto link.
        email: checked(
          "email_public",
          (v) => (/[?&#%]/.test(v ?? "") ? "" : safeEmail(v)),
          "is not an email",
        ),
        phone: checked("phone_public", normalizePhone, "is not a phone number"),
        helpWith: parseList(row.help_with).map((h) => same("help", h)),
      };
    },
    // Requiring the consent column means a wrong or reshaped tab publishes nobody.
    ["name", "consent"],
    { redact: true },
  );
  items.sort(byOrderThen(byName("name")));
  return { items, issues, skippedNoConsent };
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

export function normalizeSettings(text) {
  const { headers, rows } = parseCsvObjects(text);
  const issues = [];
  const values = {};
  for (const h of ["key", "value"]) {
    if (rows.length > 0 && !headers.includes(h))
      issues.push({ tab: "settings", line: 1, level: "error", message: `missing column "${h}"` });
  }
  for (const row of rows) {
    const key = (row.key ?? "").trim().toLowerCase();
    const value = (row.value ?? "").trim();
    const note = (message) =>
      issues.push({ tab: "settings", line: row._line, level: "warn", message });
    if (!key || !value) continue;
    const kind = SETTING_KEYS[key];
    if (!kind) {
      note(`unknown key "${key}" ignored`);
      continue;
    }
    if (kind === "email" && !safeEmail(value)) {
      note(`${key} "${value.slice(0, 60)}" is not an email; ignored`);
      continue;
    }
    if (kind === "url" && !safeUrl(value)) {
      note(`${key} "${value.slice(0, 60)}" is not an http(s) link; ignored`);
      continue;
    }
    if (kind === "link" && !safeUrl(value) && !/^\/[^/]/.test(value)) {
      note(`${key} "${value.slice(0, 60)}" must be an http(s) link or a /path; ignored`);
      continue;
    }
    values[key] = value;
  }
  return { items: values, issues };
}

export const TABS = {
  team: { env: "SHEET_TEAM_CSV", normalize: normalizeTeam },
  achievements: { env: "SHEET_ACHIEVEMENTS_CSV", normalize: normalizeAchievements },
  placements: { env: "SHEET_PLACEMENTS_CSV", normalize: normalizePlacements },
  alumni: { env: "SHEET_ALUMNI_CSV", normalize: normalizeAlumni },
  settings: { env: "SHEET_SETTINGS_CSV", normalize: normalizeSettings },
};
