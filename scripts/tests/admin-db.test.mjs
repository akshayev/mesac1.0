// The admin database: migrations, the repository (src/server/db.ts) and the alumni consent rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { D1Shim, migratedDb, migrationFiles } from "./d1-shim.mjs";
import * as db from "../../src/server/db.ts";

const ACTOR = "editor@example.com";

test("migrations apply cleanly, twice, and create every table", () => {
  const d = new D1Shim();
  for (let i = 0; i < 2; i++) for (const m of migrationFiles()) d.exec(m.sql);
  const tables = d.sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((r) => r.name);
  for (const t of [
    "achievements",
    "admins",
    "alumni",
    "audit_log",
    "placements",
    "settings",
    "team_members",
  ])
    assert.ok(tables.includes(t), t);
  const indexes = d.sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
    .all()
    .map((r) => r.name);
  for (const t of ["team_members", "achievements", "placements", "alumni"])
    assert.ok(indexes.includes(`${t}_visible_order`), t);
});

test("the database itself refuses a visible alumnus without consent", () => {
  const d = migratedDb();
  const insert = (consent, visible, consentAt, source) =>
    d.sqlite
      .prepare(
        "INSERT INTO alumni (id, name, consent, consent_at, consent_source, visible, created_at, updated_at) VALUES (?, 'X', ?, ?, ?, ?, 't', 't')",
      )
      .run(db.newId(), consent, consentAt, source, visible);
  assert.throws(() => insert(0, 1, null, null), /CHECK constraint failed/);
  assert.throws(() => insert(1, 1, null, null), /CHECK constraint failed/);
  assert.throws(() => insert(1, 1, "t", "rumour"), /CHECK constraint failed/);
  insert(1, 1, "t", "admin_entered");
  insert(0, 0, null, null);
  assert.throws(
    () =>
      d.sqlite
        .prepare(
          "INSERT INTO audit_log (id, at, actor_email, action, entity, label) VALUES (?, 't', 'a', 'x', 'alumni', 'Name')",
        )
        .run(db.newId()),
    /CHECK constraint failed/,
  );
});

test("ids are 128-bit hex", () => {
  const ids = new Set(Array.from({ length: 50 }, () => db.newId()));
  assert.equal(ids.size, 50);
  for (const id of ids) assert.match(id, /^[0-9a-f]{32}$/);
});

test("team: create, list, update, hide, move, delete", async () => {
  const d = migratedDb();
  const a = await db.createContent(
    d,
    "team",
    { name: " SAMPLE  One ", role: "Lead", visible: true },
    ACTOR,
  );
  assert.equal(a.ok, true);
  assert.equal(a.item.name, "SAMPLE One");
  assert.equal(a.item.order, 1);
  const b = await db.createContent(d, "team", { name: "SAMPLE Two", group: "Core" }, ACTOR);
  assert.equal(b.item.order, 2);
  assert.deepEqual(
    (await db.listPublic(d, "team")).map((p) => [p.name, p.group]),
    [
      ["SAMPLE One", "Team"],
      ["SAMPLE Two", "Core"],
    ],
  );
  const u = await db.updateContent(
    d,
    "team",
    a.item.id,
    { role: "Head", linkedin: "https://example.com/x" },
    ACTOR,
  );
  assert.deepEqual(u.changed.sort(), ["linkedin", "role"]);
  assert.equal(u.item.name, "SAMPLE One");
  await db.updateContent(d, "team", b.item.id, { visible: false }, ACTOR);
  assert.deepEqual(
    (await db.listPublic(d, "team")).map((p) => p.name),
    ["SAMPLE One"],
  );
  assert.equal(await db.moveContent(d, "team", b.item.id, "up"), true);
  assert.deepEqual(
    (await db.listContent(d, "team")).map((p) => p.name),
    ["SAMPLE Two", "SAMPLE One"],
  );
  assert.equal(await db.moveContent(d, "team", b.item.id, "up"), false);
  assert.equal((await db.deleteContent(d, "team", a.item.id)).name, "SAMPLE One");
  assert.equal((await db.listContent(d, "team")).length, 1);
  assert.equal(await db.deleteContent(d, "team", a.item.id), null);
});

test("validation errors name the field and nothing is saved", async () => {
  const d = migratedDb();
  const r = await db.createContent(
    d,
    "team",
    {
      name: "",
      email: "a@b.com?bcc=x",
      linkedin: "javascript:x",
      photo: "not a photo",
      order: 1.5,
      extra: 1,
    },
    ACTOR,
  );
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), [
    "email",
    "extra",
    "linkedin",
    "name",
    "order",
    "photo",
  ]);
  assert.equal((await db.listContent(d, "team")).length, 0);
  const p = await db.createContent(d, "placements", { name: "SAMPLE" }, ACTOR);
  assert.match(p.errors.company, /required/);
  const ach = await db.createContent(
    d,
    "achievements",
    { title: "SAMPLE", date: "someday" },
    ACTOR,
  );
  assert.ok(ach.errors.date);
  const ok = await db.createContent(
    d,
    "achievements",
    { title: "SAMPLE", date: "14/03/2026" },
    ACTOR,
  );
  assert.equal(ok.item.date, "2026-03-14");
});

test("alumni: consent is required to be visible, enforced in code; withdrawing consent hides", async () => {
  const d = migratedDb();
  const bad = await db.createContent(d, "alumni", { name: "SAMPLE A", visible: true }, ACTOR);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.visible);
  const hidden = await db.createContent(d, "alumni", { name: "SAMPLE H" }, ACTOR);
  assert.equal(hidden.item.visible, false);
  assert.equal(hidden.item.consentAt, null);
  const a = await db.createContent(
    d,
    "alumni",
    {
      name: "SAMPLE A",
      consent: true,
      visible: true,
      phone: "90000 00000",
      linkedin: "https://www.linkedin.com/in/sample",
      helpWith: "referrals; Career advice;referrals",
    },
    ACTOR,
  );
  assert.equal(a.ok, true);
  assert.equal(a.item.phone, "+919000000000");
  assert.equal(a.item.helpWith, "Referrals; Career advice");
  assert.equal(a.item.consentSource, "admin_entered");
  assert.ok(a.item.consentAt);
  const lookalike = await db.updateContent(
    d,
    "alumni",
    a.item.id,
    { linkedin: "https://linkedin.com.evil.com/in/x" },
    ACTOR,
  );
  assert.ok(lookalike.errors.linkedin);
  const pub = await db.listPublic(d, "alumni");
  assert.deepEqual(
    pub.map((x) => x.name),
    ["SAMPLE A"],
  );
  assert.deepEqual(pub[0].helpWith, ["Referrals", "Career advice"]);
  const firstConsent = a.item.consentAt;
  const kept = await db.updateContent(d, "alumni", a.item.id, { company: "SAMPLE Co" }, ACTOR);
  assert.equal(kept.item.consentAt, firstConsent);
  const withdrawn = await db.updateContent(d, "alumni", a.item.id, { consent: false }, ACTOR);
  assert.equal(withdrawn.item.visible, false);
  assert.equal(withdrawn.item.consentAt, null);
  assert.deepEqual(await db.listPublic(d, "alumni"), []);
  const sneaky = await db.updateContent(d, "alumni", a.item.id, { visible: true }, ACTOR);
  assert.equal(sneaky.ok, false);
});

test("public shapes match the Sheet snapshot shapes exactly", async () => {
  const { default: team } = await import("../../src/data/generated/team.json", {
    with: { type: "json" },
  });
  const { default: alumni } = await import("../../src/data/generated/alumni.json", {
    with: { type: "json" },
  });
  const d = migratedDb();
  await db.createContent(d, "team", { name: "SAMPLE" }, ACTOR);
  await db.createContent(d, "alumni", { name: "SAMPLE", consent: true, visible: true }, ACTOR);
  assert.deepEqual(
    Object.keys((await db.listPublic(d, "team"))[0]).sort(),
    Object.keys(team.items[0]).sort(),
  );
  assert.deepEqual(
    Object.keys((await db.listPublic(d, "alumni"))[0]).sort(),
    Object.keys(alumni.items[0]).sort(),
  );
});

test("settings: only known keys, validated; empty removes", async () => {
  const d = migratedDb();
  const bad = await db.saveSettings(
    d,
    { contact_email: "nope", mystery: "x", instagram_url: "javascript:x" },
    ACTOR,
  );
  assert.deepEqual(Object.keys(bad.errors).sort(), ["contact_email", "instagram_url", "mystery"]);
  const ok = await db.saveSettings(
    d,
    { contact_email: "office@example.com", announcement_link: "/archive" },
    ACTOR,
  );
  assert.deepEqual(ok.changed.sort(), ["announcement_link", "contact_email"]);
  assert.deepEqual(await db.readSettings(d), {
    announcement_link: "/archive",
    contact_email: "office@example.com",
  });
  await db.saveSettings(d, { announcement_link: "" }, ACTOR);
  assert.deepEqual(await db.readSettings(d), { contact_email: "office@example.com" });
});

test("admins: strict emails, unique, and the last active admin cannot be removed", async () => {
  const d = migratedDb();
  assert.equal(
    (await db.createAdmin(d, { email: "x'; DROP TABLE admins;--@a.com", role: "admin" }, ACTOR)).ok,
    false,
  );
  assert.equal(
    (await db.createAdmin(d, { email: "a@example.com", role: "owner" }, ACTOR)).ok,
    false,
  );
  const a = await db.createAdmin(d, { email: " A@Example.com ", role: "admin" }, ACTOR);
  assert.equal(a.account.email, "a@example.com");
  assert.equal(
    (await db.createAdmin(d, { email: "a@example.com", role: "editor" }, ACTOR)).status,
    409,
  );
  assert.equal((await db.findAdmin(d, "A@EXAMPLE.COM")).role, "admin");
  assert.equal((await db.updateAdmin(d, a.account.id, { role: "editor" }, ACTOR)).status, 409);
  assert.equal((await db.updateAdmin(d, a.account.id, { active: false }, ACTOR)).status, 409);
  assert.equal((await db.deleteAdmin(d, a.account.id)).status, 409);
  const b = await db.createAdmin(d, { email: "b@example.com", role: "admin" }, ACTOR);
  assert.equal((await db.updateAdmin(d, a.account.id, { active: false }, ACTOR)).ok, true);
  assert.equal((await db.deleteAdmin(d, b.account.id)).status, 409);
});

test("audit log: names only, labels only for public entities", async () => {
  const d = migratedDb();
  await db.writeAudit(d, {
    actor: ACTOR,
    action: "update",
    entity: "alumni",
    entityId: "x",
    label: "SAMPLE Secret Name",
    fields: ["phone", "email", "+919000000000", "a@b.com"],
  });
  await db.writeAudit(d, {
    actor: ACTOR,
    action: "update",
    entity: "team",
    entityId: "y",
    label: "SAMPLE Team Name",
    fields: ["role"],
  });
  const rows = await db.listAudit(d);
  const alumni = rows.find((r) => r.entity === "alumni");
  assert.equal(alumni.label, null);
  assert.deepEqual(alumni.fields, ["phone", "email"]);
  assert.equal(rows.find((r) => r.entity === "team").label, "SAMPLE Team Name");
  assert.doesNotMatch(
    JSON.stringify(d.sqlite.prepare("SELECT * FROM audit_log").all()),
    /9000000000|a@b\.com|Secret/,
  );
});

test("every statement the repository runs is a fixed prepared statement", async () => {
  const { SQL, ADMIN_SQL, AUDIT_SQL, SETTINGS_SQL, PHOTO_REFERENCES } =
    await import("../../src/server/sql.ts");
  const fixed = new Set([
    ...Object.values(SQL).flatMap((s) => Object.values(s).filter((v) => typeof v === "string")),
    ...Object.values(ADMIN_SQL),
    ...Object.values(AUDIT_SQL),
    ...Object.values(SETTINGS_SQL),
    PHOTO_REFERENCES,
  ]);
  const d = migratedDb();
  d.log.length = 0;
  const t = await db.createContent(
    d,
    "team",
    { name: "O'Brien \"; DROP TABLE team_members; --" },
    ACTOR,
  );
  await db.updateContent(d, "team", t.item.id, { role: "x'); --" }, ACTOR);
  await db.moveContent(d, "team", t.item.id, "down");
  await db.saveSettings(d, { footer_text: "it's" }, ACTOR);
  await db.createAdmin(d, { email: "a@example.com", role: "admin" }, ACTOR);
  await db.writeAudit(d, { actor: ACTOR, action: "x", entity: "team", fields: [] });
  await db.listAudit(d);
  await db.deleteContent(d, "team", t.item.id);
  for (const sql of d.log) assert.ok(fixed.has(sql), `ad-hoc SQL: ${sql}`);
  assert.equal(
    d.sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'team_members'").get().n,
    1,
  );
});
