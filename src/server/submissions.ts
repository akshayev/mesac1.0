/**
 * Alumni who add themselves through the public form (/alumni/join), and the approval queue behind it.
 *
 * Switched on only when the database is bound AND TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY and
 * SUBMISSION_SALT are set. A submission is never public: an admin or editor approves it, which copies it into
 * the alumni table (consent_source 'form') and empties the personal fields of the submission row.
 *
 * Nothing in this file logs or returns submitted values; errors name the field only.
 */
import { CONSENT_TEXT_VERSION } from "../shared/consent.ts";
import { ENTITIES, type EntityDef, type FieldDef } from "../shared/entities.ts";
import { newId, nowIso } from "./db.ts";
import type { AdminEnv, D1Database } from "./env.ts";
import { hasDatabase } from "./env.ts";
import { HttpError, json, notFound, readJson } from "./http.ts";
import { SQL, SUBMISSION_SQL } from "./sql.ts";
import { validateContent, type FieldErrors, type Values } from "./validate.ts";

export const SUBMISSION_BODY_LIMIT = 8 * 1024;
export const MAX_PER_IP_PER_DAY = 3;
export const MAX_PENDING = 50;
export const PENDING_DAYS = 30;
export const FORM_HEADER = "x-mesac-form";
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DAY_MS = 24 * 60 * 60 * 1000;

type Env = AdminEnv & { DB: D1Database };
type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const setting = (env: AdminEnv, key: string) => String(env[key] ?? "").trim();

/** On only with the database, both Turnstile keys and a salt of at least 32 characters. */
export function submissionsEnabled(env: AdminEnv): env is Env {
  return (
    hasDatabase(env) &&
    setting(env, "TURNSTILE_SITE_KEY") !== "" &&
    setting(env, "TURNSTILE_SECRET_KEY") !== "" &&
    setting(env, "SUBMISSION_SALT").length >= 32
  );
}

/** What the public form needs: whether it exists, and the (public) Turnstile site key. */
export function submissionConfig(env: AdminEnv): { enabled: boolean; siteKey: string } {
  return submissionsEnabled(env)
    ? { enabled: true, siteKey: setting(env, "TURNSTILE_SITE_KEY") }
    : { enabled: false, siteKey: "" };
}

const batchRequired = (f: FieldDef): FieldDef =>
  f.name === "batch" ? { ...f, required: true } : f;
/** The public form: the alumni fields without photo (people cannot upload or link one), batch required. */
export const PUBLIC_DEF: EntityDef = {
  ...ENTITIES.alumni,
  fields: ENTITIES.alumni.fields.filter((f) => f.name !== "photo").map(batchRequired),
};
/** What a reviewer may edit before approving: the same, plus a photo (upload or link). */
export const REVIEW_DEF: EntityDef = {
  ...ENTITIES.alumni,
  fields: ENTITIES.alumni.fields.map(batchRequired),
};

/** Only these fields, nothing else (no visible/order/consent flags from outside). */
function validateFields(def: EntityDef, body: Record<string, unknown>, existing?: Values) {
  const names = new Set(def.fields.map((f) => f.name));
  const picked: Record<string, unknown> = {};
  for (const n of names) if (n in body) picked[n] = body[n];
  const { values, errors } = validateContent(def, picked, existing);
  for (const k of ["visible", "consent", "order"]) delete values[k];
  delete errors.visible;
  return { values, errors };
}

/** Turnstile check. Fail-closed: no token, an HTTP error, a timeout or anything but success:true is "no". */
export async function verifyTurnstile(
  secret: string,
  token: unknown,
  { fetchFn = fetch, timeoutMs = 5000 }: { fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Promise<boolean> {
  if (typeof token !== "string" || token === "" || token.length > 2048) return false;
  try {
    const form = new FormData();
    form.set("secret", secret);
    form.set("response", token);
    const res = await fetchFn(SITEVERIFY, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: unknown };
    return data?.success === true;
  } catch {
    return false;
  }
}

/** SHA-256(salt | IP) as hex. Used only to count submissions per day; never shown or logged. */
export async function hashIp(salt: string, ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}|${ip}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Friendly, deliberately vague messages: they never repeat what was sent or explain the limits.
const TRY_LATER = "We cannot take more submissions right now. Please try again tomorrow.";
const CHECK_FAILED = "The spam check did not pass. Please complete it again and resubmit.";

export interface SubmitDeps {
  fetchFn?: typeof fetch;
  /** Clock for tests (milliseconds). */
  nowMs?: () => number;
  timeoutMs?: number;
}

/** POST /api/alumni-submission */
export async function handlePublicSubmission(
  request: Request,
  env: AdminEnv,
  deps: SubmitDeps = {},
): Promise<Response> {
  if (!submissionsEnabled(env)) return notFound();
  if (request.method !== "POST") return notFound();
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (
    origin !== new URL(request.url).origin ||
    (site && site !== "same-origin") ||
    request.headers.get(FORM_HEADER) !== "1"
  ) {
    return json({ error: "Please reload the page and try again." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await readJson(request, SUBMISSION_BODY_LIMIT);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new HttpError(400, "");
    body = parsed as Record<string, unknown>;
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 400;
    const error =
      status === 413
        ? "That is too much text. Please shorten it."
        : "Please reload the page and try again.";
    return json({ error }, status);
  }

  // Hidden field that people never see: anything in it means a bot. Pretend success, store nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") return json({ ok: true });

  if (body.consentVersion !== CONSENT_TEXT_VERSION)
    return json({ error: "The consent wording has changed. Please reload the page." }, 409);

  const allowed = new Set([
    ...PUBLIC_DEF.fields.map((f) => f.name),
    "consent",
    "consentVersion",
    "website",
    "token",
  ]);
  const errors: FieldErrors = {};
  if ("photo" in body) errors.photo = "Photos cannot be sent with this form.";
  for (const key of Object.keys(body))
    if (!allowed.has(key) && key !== "photo") errors._ = "Please reload the page and try again.";
  if (body.consent !== true) errors.consent = "Please tick the consent box to continue.";
  const checked = validateFields(PUBLIC_DEF, body);
  Object.assign(errors, checked.errors);
  if (Object.keys(errors).length) return json({ errors }, 400);

  const now = deps.nowMs?.() ?? Date.now();
  const since = new Date(now - DAY_MS).toISOString();
  const ipHash = await hashIp(
    setting(env, "SUBMISSION_SALT"),
    request.headers.get("cf-connecting-ip") ?? "unknown",
  );
  const [byIp, pending] = await Promise.all([
    env.DB.prepare(SUBMISSION_SQL.countByIpSince).bind(ipHash, since).first<{ n: number }>(),
    env.DB.prepare(SUBMISSION_SQL.countPendingSince)
      .bind(new Date(now - PENDING_DAYS * DAY_MS).toISOString())
      .first<{ n: number }>(),
  ]);
  if (Number(byIp?.n ?? 0) >= MAX_PER_IP_PER_DAY || Number(pending?.n ?? 0) >= MAX_PENDING)
    return json({ error: TRY_LATER }, 429);

  const human = await verifyTurnstile(setting(env, "TURNSTILE_SECRET_KEY"), body.token, deps);
  if (!human) return json({ error: CHECK_FAILED }, 400);

  const v = checked.values;
  const at = new Date(now).toISOString();
  await env.DB.prepare(SUBMISSION_SQL.insert)
    .bind(
      newId(),
      at,
      v.name,
      v.batch,
      v.department,
      v.currentRole,
      v.company,
      v.location,
      v.linkedin,
      v.email,
      v.phone,
      v.helpWith,
      CONSENT_TEXT_VERSION,
      at,
      ipHash,
    )
    .run();
  return json({ ok: true });
}

// ---------------------------------------------------------------------------------------------------------
// Review queue (admin API)
// ---------------------------------------------------------------------------------------------------------

export interface Submission extends Values {
  id: string;
  createdAt: string;
  consentTextVersion: string;
  consentAt: string;
}

const toSubmission = (r: Row): Submission => ({
  id: str(r.id),
  createdAt: str(r.created_at),
  name: str(r.name),
  batch: str(r.batch),
  department: str(r.department),
  currentRole: str(r.current_role),
  company: str(r.company),
  location: str(r.location),
  photo: str(r.photo),
  linkedin: str(r.linkedin),
  email: str(r.email),
  phone: str(r.phone),
  helpWith: str(r.help_with),
  consentTextVersion: str(r.consent_text_version),
  consentAt: str(r.consent_at),
});

/** Deletes rejected rows and pending rows older than 30 days, then lists what is pending. */
export async function listSubmissions(db: D1Database, now = Date.now()): Promise<Submission[]> {
  await db
    .prepare(SUBMISSION_SQL.purge)
    .bind(new Date(now - PENDING_DAYS * DAY_MS).toISOString())
    .run();
  const { results } = await db.prepare(SUBMISSION_SQL.listPending).all<Row>();
  return results.map(toSubmission);
}

async function getPending(db: D1Database, id: string) {
  const row = await db.prepare(SUBMISSION_SQL.getPending).bind(id).first<Row>();
  return row ? toSubmission(row) : null;
}

type Result<T> = ({ ok: true } & T) | { ok: false; status: 400 | 404; errors: FieldErrors };

/** Fix typos (or add a photo) before approving. */
export async function updateSubmission(
  db: D1Database,
  id: string,
  body: unknown,
): Promise<Result<{ item: Submission; changed: string[] }>> {
  const before = await getPending(db, id);
  if (!before) return { ok: false, status: 404, errors: { _: "Not found." } };
  if (!body || typeof body !== "object" || Array.isArray(body))
    return { ok: false, status: 400, errors: { _: "The request body must be a JSON object." } };
  const input = body as Record<string, unknown>;
  const names = new Set(REVIEW_DEF.fields.map((f) => f.name));
  const errors: FieldErrors = {};
  for (const k of Object.keys(input))
    if (!names.has(k)) errors[k] = "is not a field of this section";
  const { values, errors: fieldErrors } = validateFields(REVIEW_DEF, input, before);
  Object.assign(errors, fieldErrors);
  if (Object.keys(errors).length) return { ok: false, status: 400, errors };
  await db
    .prepare(SUBMISSION_SQL.update)
    .bind(
      values.name,
      values.batch,
      values.department,
      values.currentRole,
      values.company,
      values.location,
      values.photo,
      values.linkedin,
      values.email,
      values.phone,
      values.helpWith,
      id,
    )
    .run();
  const item = (await getPending(db, id)) as Submission;
  const changed = REVIEW_DEF.fields.map((f) => f.name).filter((k) => before[k] !== item[k]);
  return { ok: true, item, changed };
}

/**
 * One atomic batch: create the alumni row (consent from the form, at the time they gave it) and empty the
 * submission's personal fields, keeping it as the consent log.
 */
export async function approveSubmission(
  db: D1Database,
  id: string,
  options: { visible?: unknown },
  actor: string,
): Promise<Result<{ alumniId: string; visible: boolean }>> {
  if (options.visible !== undefined && typeof options.visible !== "boolean")
    return { ok: false, status: 400, errors: { visible: "visible must be true or false." } };
  const s = await getPending(db, id);
  if (!s) return { ok: false, status: 404, errors: { _: "Not found." } };
  const visible = options.visible !== false;
  const next = await db.prepare(SQL.alumni.nextOrder).first<{ next: number }>();
  const alumniId = newId();
  const at = nowIso();
  await db.batch([
    db
      .prepare(SQL.alumni.insert)
      .bind(
        s.name,
        s.batch,
        s.department,
        s.currentRole,
        s.company,
        s.location,
        s.photo,
        s.linkedin,
        s.email,
        s.phone,
        s.helpWith,
        1,
        s.consentAt,
        "form",
        alumniId,
        visible ? 1 : 0,
        next?.next ?? 1,
        at,
        at,
        actor,
      ),
    db.prepare(SUBMISSION_SQL.strip).bind("approved", actor, at, alumniId, id),
  ]);
  return { ok: true, alumniId, visible };
}

/** Rejecting empties the personal fields at once; the row itself goes at the next queue load. */
export async function rejectSubmission(
  db: D1Database,
  id: string,
  actor: string,
): Promise<Result<object>> {
  if (!(await getPending(db, id))) return { ok: false, status: 404, errors: { _: "Not found." } };
  await db.prepare(SUBMISSION_SQL.strip).bind("rejected", actor, nowIso(), null, id).run();
  return { ok: true };
}
