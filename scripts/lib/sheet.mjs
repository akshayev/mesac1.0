// Validation and normalisation of Google Sheet rows. Pure functions (tested in scripts/tests/sheet.test.mjs).
// Every normaliser returns { items, issues } and never throws on bad data: a bad row is skipped (or a bad
// field blanked) and described in `issues`, which ends up in data/sheet-report.md.

import { parseCsvObjects } from "./csv.mjs";
import {
  SETTING_KEYS,
  settingProblem,
  contactEmail,
  linkedinUrl,
  normalizePhone,
  parseConsent,
  parseDate,
  parseList,
  parseOrder,
  parseVisible,
  photoUrl,
  safeEmail,
  safeUrl,
  squash,
  spellingUnifier,
} from "./validate.mjs";

// The field validators live in validate.mjs (shared with the admin server); re-exported for existing callers.
export * from "./validate.mjs";

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
  const same = spellingUnifier();
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
        email: checked("email_public", contactEmail, "is not an email"),
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
    if (!SETTING_KEYS[key]) {
      note(`unknown key "${key}" ignored`);
      continue;
    }
    const problem = settingProblem(key, value);
    if (problem) {
      note(`${key} "${value.slice(0, 60)}" ${problem}; ignored`);
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
