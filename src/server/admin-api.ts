/**
 * /admin/api: the JSON API behind the dashboard. Every request is authenticated (auth.ts); every change is
 * CSRF-checked, size-limited, validated and written to the activity log (field names only).
 *
 *   GET    /admin/api/me
 *   GET    /admin/api/content/<entity>             list (including hidden rows)
 *   POST   /admin/api/content/<entity>             create
 *   PUT    /admin/api/content/<entity>/<id>        update (fields not sent keep their value)
 *   DELETE /admin/api/content/<entity>/<id>        delete (alumni: admin role only)
 *   POST   /admin/api/content/<entity>/<id>/move   { "direction": "up" | "down" }
 *   GET    /admin/api/settings | PUT /admin/api/settings
 *   GET    /admin/api/admins | POST /admin/api/admins | PUT, DELETE /admin/api/admins/<id>   (admin role only)
 *   GET    /admin/api/audit?before=<iso time>
 *   POST   /admin/api/upload                       raw image bytes, Content-Type image/jpeg|png|webp
 */
import { ENTITIES, isEntityName, type EntityName } from "../shared/entities.ts";
import { authenticate, hasRole, type AdminUser, type VerifyDeps } from "./auth.ts";
import * as db from "./db.ts";
import type { AdminEnv, D1Database } from "./env.ts";
import { csrfProblem, HttpError, json, notFound, readJson, readLimited } from "./http.ts";
import { deletePhotoIfUnused, hasMedia, MAX_UPLOAD_BYTES, storeUpload } from "./media.ts";
import { invalidatePublicCache } from "./public-data.ts";

const JSON_LIMIT = 32 * 1024;
const JSON_LIMIT_LONG = 64 * 1024; // achievements (long descriptions)
const ID = /^[0-9a-f]{32}$/;

type Env = AdminEnv & { DB: D1Database };

const PHOTO_FIELD: Record<EntityName, string> = {
  team: "photo",
  achievements: "image",
  placements: "photo",
  alumni: "photo",
};

const errors = (status: number, errs: Record<string, string>) => json({ errors: errs }, status);
const forbidden = () => json({ error: "Your role cannot do this." }, 403);

export async function handleAdminApi(
  request: Request,
  env: Env,
  deps: VerifyDeps = {},
): Promise<Response> {
  const auth = await authenticate(request, env, deps);
  if (!auth.ok) return auth.status === 404 ? notFound() : json({ error: auth.reason }, auth.status);
  const user = auth.user;

  const method = request.method.toUpperCase();
  const changing = method !== "GET" && method !== "HEAD";
  if (changing) {
    const problem = csrfProblem(request);
    if (problem) return json({ error: `Refused: ${problem}.` }, 403);
  }

  const url = new URL(request.url);
  const parts = url.pathname
    .replace(/^\/admin\/api\/?/, "")
    .split("/")
    .filter(Boolean);
  try {
    return (await route(request, env, user, method, parts, url)) ?? notFound();
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error("admin api", err);
    return json({ error: "Something went wrong. Nothing was changed." }, 500);
  }
}

async function route(
  request: Request,
  env: Env,
  user: AdminUser,
  method: string,
  parts: string[],
  url: URL,
): Promise<Response | null> {
  const [section, a, b, c] = parts;
  const audit = (entry: Omit<Parameters<typeof db.writeAudit>[1], "actor">) =>
    db.writeAudit(env.DB, { actor: user.email, ...entry });

  if (section === "me" && !a && method === "GET") {
    return json({ email: user.email, role: user.role, uploads: hasMedia(env) });
  }

  if (section === "content" && isEntityName(a)) {
    const entity = a;
    const def = ENTITIES[entity];
    const limit = entity === "achievements" ? JSON_LIMIT_LONG : JSON_LIMIT;
    if (!b) {
      if (method === "GET") return json({ items: await db.listContent(env.DB, entity) });
      if (method === "POST") {
        const r = await db.createContent(
          env.DB,
          entity,
          await readJson(request, limit),
          user.email,
        );
        if (!r.ok) return errors(r.status, r.errors);
        await audit({
          action: "create",
          entity,
          entityId: r.item.id,
          label: String(r.item[def.labelField] ?? ""),
          fields: r.changed,
        });
        invalidatePublicCache();
        return json({ item: r.item }, 201);
      }
      return null;
    }
    if (!ID.test(b)) return null;
    if (c === "move" && method === "POST") {
      const body = (await readJson(request, 1024)) as { direction?: unknown };
      if (body?.direction !== "up" && body?.direction !== "down")
        return errors(400, { direction: "must be up or down" });
      const moved = await db.moveContent(env.DB, entity, b, body.direction);
      if (moved === null) return notFound();
      if (moved) {
        const item = await db.getContent(env.DB, entity, b);
        await audit({
          action: "move",
          entity,
          entityId: b,
          label: String(item?.[def.labelField] ?? ""),
          fields: ["order"],
        });
        invalidatePublicCache();
      }
      return json({ moved });
    }
    if (c) return null;
    if (method === "PUT") {
      const r = await db.updateContent(
        env.DB,
        entity,
        b,
        await readJson(request, limit),
        user.email,
      );
      if (!r.ok) return errors(r.status, r.errors);
      if (r.changed.length) {
        const onlyVisibility = r.changed.length === 1 && r.changed[0] === "visible";
        const action = onlyVisibility ? (r.item.visible ? "show" : "hide") : "update";
        await audit({
          action,
          entity,
          entityId: b,
          label: String(r.item[def.labelField] ?? ""),
          fields: r.changed,
        });
        invalidatePublicCache();
        const field = PHOTO_FIELD[entity];
        if (r.previous && r.previous[field] !== r.item[field])
          await deletePhotoIfUnused(env, r.previous[field]);
      }
      return json({ item: r.item });
    }
    if (method === "DELETE") {
      if (entity === "alumni" && !hasRole(user, "admin")) return forbidden();
      const removed = await db.deleteContent(env.DB, entity, b);
      if (!removed) return notFound();
      await audit({
        action: "delete",
        entity,
        entityId: b,
        label: String(removed[def.labelField] ?? ""),
        fields: [],
      });
      invalidatePublicCache();
      await deletePhotoIfUnused(env, removed[PHOTO_FIELD[entity]]);
      return json({ deleted: true });
    }
    return null;
  }

  if (section === "settings" && !a) {
    if (method === "GET") return json({ values: await db.readSettings(env.DB) });
    if (method === "PUT") {
      const r = await db.saveSettings(env.DB, await readJson(request, JSON_LIMIT), user.email);
      if (!r.ok) return errors(400, r.errors);
      if (r.changed.length) {
        await audit({
          action: "update",
          entity: "settings",
          label: r.changed.join(", "),
          fields: r.changed,
        });
        invalidatePublicCache();
      }
      return json({ values: await db.readSettings(env.DB), changed: r.changed });
    }
    return null;
  }

  if (section === "admins") {
    if (!hasRole(user, "admin")) return forbidden();
    if (!a) {
      if (method === "GET") return json({ admins: await db.listAdmins(env.DB) });
      if (method === "POST") {
        const r = await db.createAdmin(env.DB, await readJson(request, 1024), user.email);
        if (!r.ok) return errors(r.status, r.errors);
        await audit({
          action: "create",
          entity: "admins",
          entityId: r.account.id,
          fields: ["email", "role"],
        });
        return json({ admin: r.account }, 201);
      }
      return null;
    }
    if (!ID.test(a) || b) return null;
    if (method === "PUT") {
      const r = await db.updateAdmin(env.DB, a, await readJson(request, 1024), user.email);
      if (!r.ok) return errors(r.status, r.errors);
      if (r.changed.length)
        await audit({ action: "update", entity: "admins", entityId: a, fields: r.changed });
      return json({ admin: r.account });
    }
    if (method === "DELETE") {
      const r = await db.deleteAdmin(env.DB, a);
      if (!r.ok) return errors(r.status, r.errors);
      await audit({ action: "delete", entity: "admins", entityId: a, fields: [] });
      return json({ deleted: true });
    }
    return null;
  }

  if (section === "audit" && !a && method === "GET") {
    return json({
      entries: await db.listAudit(env.DB, url.searchParams.get("before") ?? undefined),
    });
  }

  if (section === "upload" && !a && method === "POST") {
    const bytes = await readLimited(request, MAX_UPLOAD_BYTES);
    const r = await storeUpload(env, request.headers.get("content-type") ?? "", bytes);
    if (!r.ok) return json({ error: r.error }, r.status);
    await audit({ action: "upload", entity: "media", entityId: r.path.slice(7), fields: [] });
    return json({ path: r.path }, 201);
  }

  return null;
}
