// The data files committed to git must be sample (fixture) data. Real crawl/Sheet output is produced in CI
// at build time and never committed: the repository is public, and real snapshots and reports contain
// Drive ids, file names and people's details. These tests read the files as committed at HEAD (git show),
// so a local run with real keys that changes the working tree does not affect them; committing it does.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../..", import.meta.url));

function committed(path) {
  const r = spawnSync("git", ["show", `HEAD:${path}`], { cwd: REPO, encoding: "utf8" });
  assert.equal(r.status, 0, `cannot read ${path} at HEAD: ${r.stderr}`);
  return r.stdout;
}

const FIX =
  "If you ran the data scripts with real keys, restore the sample with `git checkout -- <file>`.";

for (const path of [
  "src/data/generated/team.json",
  "src/data/generated/achievements.json",
  "src/data/generated/placements.json",
  "src/data/generated/settings.json",
  "data/drive-files.json",
]) {
  test(`committed ${path} is sample data (source "fixture")`, () => {
    assert.equal(JSON.parse(committed(path)).source, "fixture", `${path}: ${FIX}`);
  });
}

for (const path of ["data/drive-report.md", "data/sheet-report.md"]) {
  test(`committed ${path} is a sample-data report (source "fixture")`, () => {
    const source = /"source":\s*"([^"]+)"/.exec(committed(path))?.[1];
    assert.equal(source, "fixture", `${path}: ${FIX}`);
  });
}

// archive.json is a plain list of documents with no "source" field: every document must come from the
// sample fixture (scripts/fixtures/drive-sample.json).
test("committed src/data/generated/archive.json only holds sample-fixture documents", () => {
  const fixtureIds = new Set(
    JSON.parse(readFileSync(new URL("../fixtures/drive-sample.json", import.meta.url))).files.map(
      (f) => f.id,
    ),
  );
  const docs = JSON.parse(committed("src/data/generated/archive.json"));
  assert.ok(docs.length > 0);
  const foreign = docs.map((d) => d.driveFileId).filter((id) => !fixtureIds.has(id));
  assert.deepEqual(foreign, [], `archive.json has non-sample documents. ${FIX}`);
});
