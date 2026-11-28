/**
 * Reading and writing the admin database (Cloudflare D1). Prepared statements only (see sql.ts).
 * The shapes returned to public pages are exactly the ones the Google Sheet snapshots have, so the pages do
 * not care where the data came from.
 */
import { ENTITIES, type EntityName } from "../shared/entities.ts";
import type { AchievementEntry, AlumniEntry, PlacementEntry, TeamPerson } from "../types/site.ts";
import {
  parseList,
  settingProblem,
  SETTING_KEYS,
  spellingUnifier,
  strictEmail,
} from "../../scripts/lib/validate.mjs";
import type { D1Database } from "./env.ts";
import { ADMIN_SQL, AUDIT_SQL, PHOTO_REFERENCES, SETTINGS_SQL, SQL } from "./sql.ts";
import { cleanText, validateContent, type FieldErrors, type Values } from "./validate.ts";

type Row = Record<string, unknown>;

/** 128 random bits as 32 lowercase hex characters. */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const nowIso = () => new Date().toISOString();

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const orderOf = (v: unknown) => (typeof v === "number" ? v : v == null ? null : Number(v));

// ---------------------------------------------------------------------------------------------------------
// Content (team, achievements, placements, alumni)
// ---------------------------------------------------------------------------------------------------------

export interface AdminItem extends Values {
  id: string;
  updatedAt: string;
  updatedBy: string;
}

/** A database row -> the dashboard's view of it (API field names, booleans, order). */
function toAdminItem(entity: EntityName, row: Row): AdminItem {
  const item: AdminItem = {
    id: str(row.id),
    updatedAt: str(row.updated_at),
    updatedBy: str(row.updated_by),
    visible: row.visible === 1,
    order: orderOf(row.sort_order),
  };
  for (const [field, column] of SQL[entity].columns) {
    if (field === "consent") item.consent = row.consent === 1;
    else if (field === "date") item.date = row.date == null ? null : str(row.date);
    else if (field === "consentAt" || field === "consentSource")
      item[field] = row[column] == null ? null : str(row[column]);
    else item[field] = str(row[column]);
  }
  return item;
}

export async function listContent(db: D1Database, entity: EntityName): Promise<AdminItem[]> {
  const { results } = await db.prepare(SQL[entity].listAll).all<Row>();
  return results.map((r) => toAdminItem(entity, r));
}

export async function getContent(
  db: D1Database,
  entity: EntityName,
  id: string,
): Promise<AdminItem | null> {
  const row = await db.prepare(SQL[entity].get).bind(id).first<Row>();
  return row ? toAdminItem(entity, row) : null;
}

/** Bind values for the content columns of INSERT/UPDATE, in sql.ts order. */
function contentBinds(entity: EntityName, v: Values): unknown[] {
  return SQL[entity].columns.map(([field]) => {
    const value = v[field];
    if (typeof value === "boolean") return value ? 1 : 0;
    return value ?? null;
  });
}

/** Alumni consent bookkeeping: when consent was given and how, cleared when it is withdrawn. */
function withConsentMeta(entity: EntityName, values: Values, before?: AdminItem): Values {
  if (entity !== "alumni") return values;
  if (values.consent !== true)
    return { ...values, consentAt: null, consentSource: null, visible: false };
  if (before?.consent === true) {
    return { ...values, consentAt: before.consentAt, consentSource: before.consentSource };
  }
  return { ...values, consentAt: nowIso(), consentSource: "admin_entered" };
}

export type SaveResult =
  | { ok: true; item: AdminItem; changed: string[]; previous?: AdminItem }
  | { ok: false; status: 400 | 404; errors: FieldErrors };

export async function createContent(
  db: D1Database,
  entity: EntityName,
  body: unknown,
  actor: string,
): Promise<SaveResult> {
  const { values, errors } = validateContent(ENTITIES[entity], body);
  if (Object.keys(errors).length) return { ok: false, status: 400, errors };
  const id = newId();
  const at = nowIso();
  if (values.order === null) {
    const next = await db.prepare(SQL[entity].nextOrder).first<{ next: number }>();
    values.order = next?.next ?? 1;
  }
  const v = withConsentMeta(entity, values);
  await db
    .prepare(SQL[entity].insert)
    .bind(...contentBinds(entity, v), id, v.visible ? 1 : 0, v.order, at, at, actor)
    .run();
  const item = (await getContent(db, entity, id)) as AdminItem;
  return { ok: true, item, changed: Object.keys(values) };
}

export async function updateContent(
  db: D1Database,
  entity: EntityName,
  id: string,
  body: unknown,
  actor: string,
): Promise<SaveResult> {
  const before = await getContent(db, entity, id);
  if (!before) return { ok: false, status: 404, errors: { _: "Not found." } };
  const { values, errors } = validateContent(ENTITIES[entity], body, before);
  if (Object.keys(errors).length) return { ok: false, status: 400, errors };
  const v = withConsentMeta(entity, values, before);
  await db
    .prepare(SQL[entity].update)
    .bind(...contentBinds(entity, v), v.visible ? 1 : 0, v.order ?? null, nowIso(), actor, id)
    .run();
  const item = (await getContent(db, entity, id)) as AdminItem;
  const changed = Object.keys(values).filter((k) => values[k] !== before[k]);
  return { ok: true, item, changed, previous: before };
}

export async function deleteContent(
  db: D1Database,
  entity: EntityName,
  id: string,
): Promise<AdminItem | null> {
  const before = await getContent(db, entity, id);
  if (!before) return null;
  await db.prepare(SQL[entity].remove).bind(id).run();
  return before;
}

/** Swaps an item with its neighbour and renumbers the list 1, 2, 3... Returns false at either end. */
export async function moveContent(
  db: D1Database,
  entity: EntityName,
  id: string,
  direction: "up" | "down",
): Promise<boolean | null> {
  const items = await listContent(db, entity);
  const i = items.findIndex((it) => it.id === id);
  if (i < 0) return null;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= items.length) return false;
  [items[i], items[j]] = [items[j], items[i]];
  const statements = items
    .map((it, n) => ({ it, order: n + 1 }))
    .filter(({ it, order }) => it.order !== order)
    .map(({ it, order }) => db.prepare(SQL[entity].setOrder).bind(order, it.id));
  if (statements.length) await db.batch(statements);
  return true;
}

export async function photoReferences(db: D1Database, path: string): Promise<number> {
  const row = await db
    .prepare(PHOTO_REFERENCES)
    .bind(path, path, path, path)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

// ---------------------------------------------------------------------------------------------------------
// Public shapes (identical to the Sheet snapshots)
// ---------------------------------------------------------------------------------------------------------

export interface PublicContent {
  team: TeamPerson[];
  achievements: AchievementEntry[];
  placements: PlacementEntry[];
  alumni: AlumniEntry[];
}

export async function listPublic<K extends EntityName>(
  db: D1Database,
  entity: K,
): Promise<PublicContent[K]> {
  const { results } = await db.prepare(SQL[entity].listPublic).all<Row>();
  const order = (r: Row) => orderOf(r.sort_order);
  switch (entity) {
    case "team":
      return results.map((r) => ({
        name: str(r.name),
        role: str(r.role),
        group: str(r.group_name) || "Team",
        photo: str(r.photo),
        linkedin: str(r.linkedin),
        email: str(r.email),
        order: order(r),
      })) as PublicContent[K];
    case "achievements":
      return results.map((r) => ({
        title: str(r.title),
        date: r.date == null ? null : str(r.date),
        category: str(r.category),
        description: str(r.description),
        image: str(r.image),
        link: str(r.link),
        order: order(r),
      })) as PublicContent[K];
    case "placements":
      return results.map((r) => ({
        name: str(r.name),
        company: str(r.company),
        role: str(r.role),
        batch: str(r.batch),
        photo: str(r.photo),
        linkedin: str(r.linkedin),
        order: order(r),
      })) as PublicContent[K];
    case "alumni": {
      const same = spellingUnifier();
      return results.map((r) => ({
        name: str(r.name),
        batch: same("batch", str(r.batch)),
        department: same("department", str(r.department)),
        currentRole: str(r.current_role),
        company: str(r.company),
        location: str(r.location),
        photo: str(r.photo),
        linkedin: str(r.linkedin),
        email: str(r.email),
        phone: str(r.phone),
        helpWith: parseList(r.help_with).map((h) => same("help", h)),
        order: order(r),
      })) as PublicContent[K];
    }
  }
  return [] as unknown as PublicContent[K];
}

// ---------------------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------------------

export async function readSettings(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare(SETTINGS_SQL.all).all<Row>();
  const out: Record<string, string> = {};
  for (const r of results) if (SETTING_KEYS[str(r.key)]) out[str(r.key)] = str(r.value);
  return out;
}

/** body: { key: value } for some known keys; an empty value removes the key. */
export async function saveSettings(
  db: D1Database,
  body: unknown,
  actor: string,
): Promise<{ ok: true; changed: string[] } | { ok: false; errors: FieldErrors }> {
  if (!body || typeof body !== "object" || Array.isArray(body))
    return { ok: false, errors: { _: "The request body must be a JSON object." } };
  const errors: FieldErrors = {};
  const clean: Record<string, string> = {};
  for (const [key, raw] of Object.entries(body as Record<string, unknown>)) {
    if (!SETTING_KEYS[key]) errors[key] = "is not a known setting";
    else if (typeof raw !== "string") errors[key] = "must be text";
    else {
      const value = cleanText(raw);
      const problem = value ? settingProblem(key, value) : "";
      if (value.length > 500) errors[key] = "must be at most 500 characters";
      else if (problem) errors[key] = problem;
      else clean[key] = value;
    }
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  const current = await readSettings(db);
  const changed = Object.keys(clean).filter((k) => (current[k] ?? "") !== clean[k]);
  const at = nowIso();
  const statements = changed.map((k) =>
    clean[k]
      ? db.prepare(SETTINGS_SQL.upsert).bind(k, clean[k], at, actor)
      : db.prepare(SETTINGS_SQL.remove).bind(k),
  );
  if (statements.length) await db.batch(statements);
  return { ok: true, changed };
}

// ---------------------------------------------------------------------------------------------------------
// Admins
// ---------------------------------------------------------------------------------------------------------

export type Role = "admin" | "editor";
export interface AdminAccount {
  id: string;
  email: string;
  role: Role;
  active: boolean;
}

const toAccount = (r: Row): AdminAccount => ({
  id: str(r.id),
  email: str(r.email),
  role: r.role === "admin" ? "admin" : "editor",
  active: r.active === 1,
});

export async function findAdmin(db: D1Database, email: string): Promise<AdminAccount | null> {
  const row = await db.prepare(ADMIN_SQL.byEmail).bind(email).first<Row>();
  return row ? toAccount(row) : null;
}

export async function listAdmins(db: D1Database) {
  const { results } = await db.prepare(ADMIN_SQL.all).all<Row>();
  return results.map((r) => ({
    ...toAccount(r),
    updatedAt: str(r.updated_at),
    updatedBy: str(r.updated_by),
  }));
}

const isRole = (v: unknown): v is Role => v === "admin" || v === "editor";

export async function createAdmin(
  db: D1Database,
  body: unknown,
  actor: string,
): Promise<
  { ok: true; account: AdminAccount } | { ok: false; status: 400 | 409; errors: FieldErrors }
> {
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: FieldErrors = {};
  const email = strictEmail(input.email);
  if (!email) errors.email = "Enter one valid email address.";
  if (!isRole(input.role)) errors.role = "Role must be admin or editor.";
  for (const key of Object.keys(input))
    if (key !== "email" && key !== "role") errors[key] = "is not a field of this section";
  if (Object.keys(errors).length) return { ok: false, status: 400, errors };
  if (await findAdmin(db, email))
    return { ok: false, status: 409, errors: { email: "This email is already listed." } };
  const id = newId();
  const at = nowIso();
  await db.prepare(ADMIN_SQL.insert).bind(id, email, input.role, 1, at, at, actor).run();
  return { ok: true, account: { id, email, role: input.role as Role, active: true } };
}

async function wouldRemoveLastAdmin(
  db: D1Database,
  target: AdminAccount,
  next: { role: Role; active: boolean },
) {
  const losesAdmin =
    target.role === "admin" && target.active && (next.role !== "admin" || !next.active);
  if (!losesAdmin) return false;
  const row = await db.prepare(ADMIN_SQL.activeAdminsExcept).bind(target.id).first<{ n: number }>();
  return Number(row?.n ?? 0) === 0;
}

export async function updateAdmin(
  db: D1Database,
  id: string,
  body: unknown,
  actor: string,
): Promise<
  | { ok: true; account: AdminAccount; changed: string[] }
  | { ok: false; status: 400 | 404 | 409; errors: FieldErrors }
> {
  const row = await db.prepare(ADMIN_SQL.get).bind(id).first<Row>();
  if (!row) return { ok: false, status: 404, errors: { _: "Not found." } };
  const before = toAccount(row);
  const input = (body ?? {}) as Record<string, unknown>;
  const errors: FieldErrors = {};
  for (const key of Object.keys(input))
    if (key !== "role" && key !== "active") errors[key] = "is not a field of this section";
  const role = "role" in input ? input.role : before.role;
  const active = "active" in input ? input.active : before.active;
  if (!isRole(role)) errors.role = "Role must be admin or editor.";
  if (typeof active !== "boolean") errors.active = "active must be true or false.";
  if (Object.keys(errors).length) return { ok: false, status: 400, errors };
  const next = { role: role as Role, active: active as boolean };
  if (await wouldRemoveLastAdmin(db, before, next))
    return {
      ok: false,
      status: 409,
      errors: { _: "There must always be at least one active admin." },
    };
  await db
    .prepare(ADMIN_SQL.update)
    .bind(next.role, next.active ? 1 : 0, nowIso(), actor, id)
    .run();
  const changed = (["role", "active"] as const).filter((k) => before[k] !== next[k]);
  return { ok: true, account: { ...before, ...next }, changed };
}

export async function deleteAdmin(
  db: D1Database,
  id: string,
): Promise<
  { ok: true; account: AdminAccount } | { ok: false; status: 404 | 409; errors: FieldErrors }
> {
  const row = await db.prepare(ADMIN_SQL.get).bind(id).first<Row>();
  if (!row) return { ok: false, status: 404, errors: { _: "Not found." } };
  const account = toAccount(row);
  if (await wouldRemoveLastAdmin(db, account, { role: "editor", active: false }))
    return {
      ok: false,
      status: 409,
      errors: { _: "There must always be at least one active admin." },
    };
  await db.prepare(ADMIN_SQL.remove).bind(id).run();
  return { ok: true, account };
}

// ---------------------------------------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------------------------------------

export type AuditEntity = EntityName | "settings" | "admins" | "media" | "submissions" | "papers";

/** Entities whose content is public anyway, so a name/title/key is a harmless label. */
// "media": cleanup counts only ("3 deleted"); "papers": never labelled.
const LABELLED = new Set<AuditEntity>(["team", "achievements", "placements", "settings", "media"]);

export async function writeAudit(
  db: D1Database,
  entry: {
    actor: string;
    action: string;
    entity: AuditEntity;
    entityId?: string;
    label?: string;
    fields: string[];
  },
): Promise<void> {
  const label =
    LABELLED.has(entry.entity) && entry.label ? cleanText(entry.label).slice(0, 120) : null;
  // Field NAMES only: values (phone numbers, emails, ...) never reach the log.
  const fields = JSON.stringify(
    [...new Set(entry.fields)].filter((f) => /^[A-Za-z_]{1,40}$/.test(f)),
  );
  await db
    .prepare(AUDIT_SQL.insert)
    .bind(
      newId(),
      nowIso(),
      entry.actor,
      entry.action,
      entry.entity,
      entry.entityId ?? "",
      label,
      fields,
    )
    .run();
}

export async function listAudit(db: D1Database, before?: string, limit = 50) {
  const cursor = before && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(before) ? before : "9999";
  const { results } = await db
    .prepare(AUDIT_SQL.recent)
    .bind(cursor, Math.min(Math.max(limit, 1), 200))
    .all<Row>();
  return results.map((r) => ({
    id: str(r.id),
    at: str(r.at),
    actor: str(r.actor_email),
    action: str(r.action),
    entity: str(r.entity),
    entityId: str(r.entity_id),
    label: r.label == null ? null : str(r.label),
    fields: JSON.parse(str(r.changed_fields) || "[]") as string[],
  }));
}
