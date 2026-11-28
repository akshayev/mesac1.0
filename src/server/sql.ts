/**
 * Every SQL statement the admin server runs, written out in full. Values are always bound with `?`
 * (prepared statements); nothing from a request is ever pasted into SQL text.
 * `columns` lists, in bind order, the content columns of each INSERT/UPDATE below.
 */
import type { EntityName } from "../shared/entities.ts";

export interface EntitySql {
  table: string;
  /** API field name -> column, in the bind order used by insert and update. */
  columns: Array<[field: string, column: string]>;
  listAll: string;
  listPublic: string;
  get: string;
  insert: string;
  update: string;
  remove: string;
  nextOrder: string;
  setOrder: string;
}

const BY_NAME = "ORDER BY sort_order IS NULL, sort_order, name COLLATE NOCASE, id";

export const SQL: Record<EntityName, EntitySql> = {
  team: {
    table: "team_members",
    columns: [
      ["name", "name"],
      ["role", "role"],
      ["group", "group_name"],
      ["photo", "photo"],
      ["linkedin", "linkedin"],
      ["email", "email"],
    ],
    listAll: `SELECT * FROM team_members ${BY_NAME}`,
    listPublic: `SELECT * FROM team_members WHERE visible = 1 ${BY_NAME}`,
    get: "SELECT * FROM team_members WHERE id = ?",
    insert:
      "INSERT INTO team_members (name, role, group_name, photo, linkedin, email, id, visible, sort_order, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    update:
      "UPDATE team_members SET name = ?, role = ?, group_name = ?, photo = ?, linkedin = ?, email = ?, visible = ?, sort_order = ?, updated_at = ?, updated_by = ? WHERE id = ?",
    remove: "DELETE FROM team_members WHERE id = ?",
    nextOrder: "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM team_members",
    setOrder: "UPDATE team_members SET sort_order = ? WHERE id = ?",
  },
  achievements: {
    table: "achievements",
    columns: [
      ["title", "title"],
      ["date", "date"],
      ["category", "category"],
      ["description", "description"],
      ["image", "image"],
      ["link", "link"],
    ],
    listAll:
      "SELECT * FROM achievements ORDER BY sort_order IS NULL, sort_order, date IS NULL, date DESC, title COLLATE NOCASE, id",
    listPublic:
      "SELECT * FROM achievements WHERE visible = 1 ORDER BY sort_order IS NULL, sort_order, date IS NULL, date DESC, title COLLATE NOCASE, id",
    get: "SELECT * FROM achievements WHERE id = ?",
    insert:
      "INSERT INTO achievements (title, date, category, description, image, link, id, visible, sort_order, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    update:
      "UPDATE achievements SET title = ?, date = ?, category = ?, description = ?, image = ?, link = ?, visible = ?, sort_order = ?, updated_at = ?, updated_by = ? WHERE id = ?",
    remove: "DELETE FROM achievements WHERE id = ?",
    nextOrder: "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM achievements",
    setOrder: "UPDATE achievements SET sort_order = ? WHERE id = ?",
  },
  placements: {
    table: "placements",
    columns: [
      ["name", "name"],
      ["company", "company"],
      ["role", "role"],
      ["batch", "batch"],
      ["photo", "photo"],
      ["linkedin", "linkedin"],
    ],
    listAll: `SELECT * FROM placements ${BY_NAME}`,
    listPublic: `SELECT * FROM placements WHERE visible = 1 ${BY_NAME}`,
    get: "SELECT * FROM placements WHERE id = ?",
    insert:
      "INSERT INTO placements (name, company, role, batch, photo, linkedin, id, visible, sort_order, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    update:
      "UPDATE placements SET name = ?, company = ?, role = ?, batch = ?, photo = ?, linkedin = ?, visible = ?, sort_order = ?, updated_at = ?, updated_by = ? WHERE id = ?",
    remove: "DELETE FROM placements WHERE id = ?",
    nextOrder: "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM placements",
    setOrder: "UPDATE placements SET sort_order = ? WHERE id = ?",
  },
  alumni: {
    table: "alumni",
    columns: [
      ["name", "name"],
      ["batch", "batch"],
      ["department", "department"],
      ["currentRole", "current_role"],
      ["company", "company"],
      ["location", "location"],
      ["photo", "photo"],
      ["linkedin", "linkedin"],
      ["email", "email"],
      ["phone", "phone"],
      ["helpWith", "help_with"],
      ["consent", "consent"],
      ["consentAt", "consent_at"],
      ["consentSource", "consent_source"],
    ],
    listAll: `SELECT * FROM alumni ${BY_NAME}`,
    // Both conditions, although the table's CHECK already makes visible imply consent.
    listPublic: `SELECT * FROM alumni WHERE visible = 1 AND consent = 1 ${BY_NAME}`,
    get: "SELECT * FROM alumni WHERE id = ?",
    insert:
      "INSERT INTO alumni (name, batch, department, current_role, company, location, photo, linkedin, email, phone, help_with, consent, consent_at, consent_source, id, visible, sort_order, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    update:
      "UPDATE alumni SET name = ?, batch = ?, department = ?, current_role = ?, company = ?, location = ?, photo = ?, linkedin = ?, email = ?, phone = ?, help_with = ?, consent = ?, consent_at = ?, consent_source = ?, visible = ?, sort_order = ?, updated_at = ?, updated_by = ? WHERE id = ?",
    remove: "DELETE FROM alumni WHERE id = ?",
    nextOrder: "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM alumni",
    setOrder: "UPDATE alumni SET sort_order = ? WHERE id = ?",
  },
};

/** How many rows anywhere still use a photo path (an R2 file is deleted only when this reaches 0). */
export const PHOTO_REFERENCES =
  "SELECT (SELECT COUNT(*) FROM team_members WHERE photo = ?) + (SELECT COUNT(*) FROM achievements WHERE image = ?) + (SELECT COUNT(*) FROM placements WHERE photo = ?) + (SELECT COUNT(*) FROM alumni WHERE photo = ?) AS n";

export const SETTINGS_SQL = {
  all: "SELECT key, value, updated_at, updated_by FROM settings ORDER BY key",
  upsert:
    "INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
  remove: "DELETE FROM settings WHERE key = ?",
};

export const ADMIN_SQL = {
  byEmail: "SELECT id, email, role, active FROM admins WHERE email = ? COLLATE NOCASE",
  all: "SELECT id, email, role, active, created_at, updated_at, updated_by FROM admins ORDER BY email",
  get: "SELECT id, email, role, active FROM admins WHERE id = ?",
  insert:
    "INSERT INTO admins (id, email, role, active, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
  update: "UPDATE admins SET role = ?, active = ?, updated_at = ?, updated_by = ? WHERE id = ?",
  remove: "DELETE FROM admins WHERE id = ?",
  activeAdminsExcept:
    "SELECT COUNT(*) AS n FROM admins WHERE role = 'admin' AND active = 1 AND id <> ?",
};

export const AUDIT_SQL = {
  insert:
    "INSERT INTO audit_log (id, at, actor_email, action, entity, entity_id, label, changed_fields) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  recent:
    "SELECT id, at, actor_email, action, entity, entity_id, label, changed_fields FROM audit_log WHERE at < ? ORDER BY at DESC, id DESC LIMIT ?",
};

/** Public alumni submissions (migrations/0002). The strip statement empties every personal field. */
export const SUBMISSION_SQL = {
  insert:
    "INSERT INTO alumni_submissions (id, created_at, status, name, batch, department, current_role, company, location, linkedin, email, phone, help_with, consent_text_version, consent_at, ip_hash) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  countByIpSince:
    "SELECT COUNT(*) AS n FROM alumni_submissions WHERE ip_hash = ? AND created_at > ?",
  countPendingSince:
    "SELECT COUNT(*) AS n FROM alumni_submissions WHERE status = 'pending' AND created_at > ?",
  purge:
    "DELETE FROM alumni_submissions WHERE status = 'rejected' OR (status = 'pending' AND created_at < ?)",
  listPending:
    "SELECT id, created_at, name, batch, department, current_role, company, location, photo, linkedin, email, phone, help_with, consent_text_version, consent_at FROM alumni_submissions WHERE status = 'pending' ORDER BY created_at",
  getPending:
    "SELECT id, created_at, name, batch, department, current_role, company, location, photo, linkedin, email, phone, help_with, consent_text_version, consent_at FROM alumni_submissions WHERE id = ? AND status = 'pending'",
  update:
    "UPDATE alumni_submissions SET name = ?, batch = ?, department = ?, current_role = ?, company = ?, location = ?, photo = ?, linkedin = ?, email = ?, phone = ?, help_with = ? WHERE id = ? AND status = 'pending'",
  strip:
    "UPDATE alumni_submissions SET status = ?, name = '', batch = '', department = '', current_role = '', company = '', location = '', photo = '', linkedin = '', email = '', phone = '', help_with = '', ip_hash = NULL, reviewed_by = ?, reviewed_at = ?, alumni_id = ? WHERE id = ? AND status = 'pending'",
};
