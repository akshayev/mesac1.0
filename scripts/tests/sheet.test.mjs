import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeAchievements,
  normalizePlacements,
  normalizeSettings,
  normalizeTeam,
  parseDate,
  parseVisible,
  photoUrl,
  safeUrl,
} from "../lib/sheet.mjs";

const fixture = (name) =>
  readFileSync(new URL(`../fixtures/sheet-sample/${name}.csv`, import.meta.url), "utf8");

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const THUMB = `https://drive.google.com/thumbnail?id=${ID}&sz=w600`;

test("photoUrl: Drive links and bare ids become thumbnail URLs", () => {
  assert.equal(photoUrl(`https://drive.google.com/file/d/${ID}/view?usp=sharing`), THUMB);
  assert.equal(photoUrl(`https://drive.google.com/open?id=${ID}`), THUMB);
  assert.equal(photoUrl(`https://drive.google.com/uc?export=view&id=${ID}`), THUMB);
  assert.equal(photoUrl(ID), THUMB);
});

test("photoUrl: other https URLs pass through, junk is rejected", () => {
  assert.equal(photoUrl("https://example.com/a.jpg"), "https://example.com/a.jpg");
  assert.equal(photoUrl("javascript:alert(1)"), "");
  assert.equal(photoUrl("data:image/png;base64,AAAA"), "");
  assert.equal(photoUrl("not a photo"), "");
  assert.equal(photoUrl(""), "");
});

test("photoUrl: public/people paths", () => {
  assert.equal(photoUrl("people/ada.jpg"), "/people/ada.jpg");
  assert.equal(photoUrl("/people/ada.png"), "/people/ada.png");
  assert.equal(photoUrl("ada.webp"), "/people/ada.webp");
  assert.equal(photoUrl("../secrets.jpg"), "");
});

test("safeUrl only accepts http(s)", () => {
  assert.equal(safeUrl("https://example.com/x"), "https://example.com/x");
  assert.equal(safeUrl("mailto:a@b.c"), "");
  assert.equal(safeUrl("example.com"), "");
});

test("parseVisible: blank is visible; FALSE/no/0 hide", () => {
  assert.equal(parseVisible(""), true);
  assert.equal(parseVisible("TRUE"), true);
  for (const v of ["FALSE", "false", "No", "0", "hidden"]) assert.equal(parseVisible(v), false, v);
});

test("parseDate: ISO, DD/MM/YYYY, text months, junk", () => {
  assert.equal(parseDate("2026-03-14"), "2026-03-14");
  assert.equal(parseDate("14/03/2026"), "2026-03-14");
  assert.equal(parseDate("14-03-2026"), "2026-03-14");
  assert.equal(parseDate("14 Mar 2026"), "2026-03-14");
  assert.equal(parseDate("31/02/2026"), null);
  assert.equal(parseDate("someday"), null);
  assert.equal(parseDate(""), null);
});

test("team: hidden and nameless rows dropped, quoted comma kept, sorted by order then name", () => {
  const { items, issues } = normalizeTeam(fixture("team"));
  const names = items.map((i) => i.name);
  assert.ok(!names.includes("SAMPLE Hidden Person"));
  assert.ok(names.includes("SAMPLE Treasurer, Jr"));
  assert.deepEqual(
    items.map((i) => i.order),
    [1, 2, 3, 4, 5, 6],
  );
  assert.ok(issues.some((i) => /empty name/.test(i.message)));
});

test("team: bad photo/link/email are blanked and reported, row is kept", () => {
  const { items, issues } = normalizeTeam(fixture("team"));
  const row = items.find((i) => i.name === "SAMPLE Design Lead");
  assert.equal(row.photo, "");
  assert.equal(row.linkedin, "");
  assert.equal(row.email, "");
  assert.equal(issues.filter((i) => i.line === 7).length, 3);
  assert.equal(items.find((i) => i.name === "SAMPLE Technical Lead").photo, THUMB);
});

test("team: missing order sorts last, ties break by name", () => {
  const csv = "name,order\nZed,\nAmy,\nBob,1\n";
  assert.deepEqual(
    normalizeTeam(csv).items.map((i) => i.name),
    ["Bob", "Amy", "Zed"],
  );
});

test("team: reports a missing required column", () => {
  const { issues } = normalizeTeam("title,role\nA,B\n");
  assert.ok(issues.some((i) => i.level === "error" && /name/.test(i.message)));
});

test("achievements: multi-line description, dates coerced, bad date kept without a date", () => {
  const { items, issues } = normalizeAchievements(fixture("achievements"));
  assert.equal(items.length, 4);
  assert.match(items[0].description, /\n/);
  assert.equal(items[0].date, "2026-03-14");
  assert.equal(items[1].date, "2026-01-12");
  assert.equal(items[3].date, null);
  assert.ok(issues.some((i) => /date "someday"/.test(i.message)));
});

test("placements: company required, no salary field leaks through", () => {
  const { items, issues } = normalizePlacements(fixture("placements"));
  assert.equal(items.length, 3);
  assert.ok(issues.some((i) => /empty company/.test(i.message)));
  for (const it of items)
    assert.deepEqual(Object.keys(it).sort(), [
      "batch",
      "company",
      "linkedin",
      "name",
      "order",
      "photo",
      "role",
    ]);
  const withSalary = normalizePlacements("name,company,package,visible\nA,B,12 LPA,TRUE\n")
    .items[0];
  assert.equal("package" in withSalary, false);
});

test("settings: known keys kept, blanks dropped, bad values reported", () => {
  const { items, issues } = normalizeSettings(fixture("settings"));
  assert.equal(items.stat_members, "100");
  assert.equal("contact_email" in items, false);
  assert.equal("contact_phone" in items, false);
  assert.equal(items.announcement_link, "/archive");
  assert.ok(issues.some((i) => /mystery_key/.test(i.message)));
  const bad = normalizeSettings("key,value\ncontact_email,nope\ninstagram_url,javascript:x\n");
  assert.deepEqual(bad.items, {});
  assert.equal(bad.issues.length, 2);
});
