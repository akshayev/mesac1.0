// End-to-end tests of the real data scripts (not fixtures) against scripts/tests/mock-google.mjs.
// Each test runs the actual script in a child process with MESAC_PROJECT_ROOT pointing at a temporary
// copy of the inputs, so the repository's own data files are never touched.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { IDS, RESOURCE_KEYS, startMockGoogle } from "./mock-google.mjs";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const KEY = `test-key-${randomBytes(6).toString("hex")}`;
const TABS = ["team", "achievements", "placements", "settings"];

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "mesac-realpath-"));
  mkdirSync(join(root, "src/data"), { recursive: true });
  cpSync(join(REPO, "src/data/subjects.json"), join(root, "src/data/subjects.json"));
  cpSync(
    join(REPO, "src/data/archive-overrides.json"),
    join(root, "src/data/archive-overrides.json"),
  );
  cpSync(join(REPO, "scripts/fixtures"), join(root, "scripts/fixtures"), { recursive: true });
  return root;
}

/** Runs a script with a minimal environment (no inherited secrets). */
function run(script, root, env = {}, args = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(REPO, "scripts", script), ...args], {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        MESAC_PROJECT_ROOT: root,
        RETRY_BASE_MS: "5",
        ...env,
      },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
}

const read = (root, rel) => readFileSync(join(root, rel), "utf8");
const readJson = (root, rel) => JSON.parse(read(root, rel));

function allFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...allFiles(p));
    else out.push(p);
  }
  return out;
}

const driveEnv = (mock, extra = {}) => ({
  GOOGLE_API_KEY: KEY,
  DRIVE_ROOT_ID: IDS.root,
  DRIVE_API_BASE: mock.driveBase,
  ...extra,
});

/** A previous real crawl with `n` files, written as the committed snapshot. */
function seedDriveSnapshot(root, n) {
  const snap = {
    source: "drive",
    generatedAt: "2026-01-01T00:00:00.000Z",
    rootId: IDS.root,
    files: Array.from({ length: n }, (_, i) => ({
      path: [
        "S1-8",
        "S5",
        "PYQ",
        "Thermal Engineering",
        "2019 scheme",
        `Thermal Engineering 20${10 + i} Nov (2019 Ad).pdf`,
      ],
      id: `SEEDfile${String(i).padStart(8, "0")}`,
      size: 1000,
      mimeType: "application/pdf",
      modifiedTime: "2026-01-01T00:00:00.000Z",
      owner: null,
      ownerKnown: true,
    })),
    skipped: [],
  };
  mkdirSync(join(root, "data"), { recursive: true });
  const text = `${JSON.stringify(snap, null, 2)}\n`;
  writeFileSync(join(root, "data/drive-files.json"), text);
  return text;
}

// ---------------------------------------------------------------------------
// Drive crawl + mirror
// ---------------------------------------------------------------------------

test("drive: full crawl, retries, resource keys, skipped types, mirror and no key leaks", async () => {
  const mock = await startMockGoogle({ apiKey: KEY });
  const root = makeRoot();
  mkdirSync(join(root, "public/files"), { recursive: true });
  writeFileSync(join(root, "public/files/STALEfile000001.pdf"), "old");
  try {
    const r = await run("drive-index.mjs", root, driveEnv(mock));
    assert.equal(r.code, 0, r.out);

    // Tree walk + pagination: every real file was found (folder with 7 entries = 4 pages).
    const snap = readJson(root, "data/drive-files.json");
    assert.equal(snap.source, "drive");
    const ids = snap.files.map((f) => f.id).sort();
    assert.deepEqual(
      ids,
      [IDS.dataBook, IDS.keyed, IDS.quota, IDS.thermalNov2021, IDS.thermalJan2023].sort(),
    );
    const pages = mock.requests.filter(
      (q) => q.path === "/drive/v3/files" && q.query.q?.includes("FOLDERscheme201"),
    );
    assert.equal(pages.length, 4, "expected 4 pages for the 7-item folder");

    // Retries: the 403 rateLimitExceeded and the 500 were both retried until they succeeded.
    const listed = (id) =>
      mock.requests.filter((q) => q.path === "/drive/v3/files" && q.query.q?.includes(id)).length;
    assert.equal(listed("FOLDERpyq5xx01"), 2);
    assert.equal(listed("FOLDERsem5xx01"), 2);
    assert.match(r.out, /HTTP 403, retrying/);
    assert.match(r.out, /HTTP 500, retrying/);

    // Resource keys: sent when listing the keyed folder and when downloading the keyed file.
    const keyedList = mock.requests.find(
      (q) => q.path === "/drive/v3/files" && q.query.q?.includes(IDS.thermalFolder),
    );
    assert.equal(
      keyedList.headers["x-goog-drive-resource-keys"],
      `${IDS.thermalFolder}/${RESOURCE_KEYS[IDS.thermalFolder]}`,
    );
    const keyedDownload = mock.requests.find((q) => q.path === `/drive/v3/files/${IDS.keyed}`);
    assert.equal(
      keyedDownload.headers["x-goog-drive-resource-keys"],
      `${IDS.keyed}/${RESOURCE_KEYS[IDS.keyed]}`,
    );
    // Every Drive request carried the key.
    for (const q of mock.requests) assert.equal(q.query.key, KEY, q.path);

    // Shortcut, Google Doc and the unsafe id were skipped and reported.
    const skipped = snap.skipped.map((s) => s.mimeType);
    assert.ok(skipped.includes("application/vnd.google-apps.shortcut"));
    assert.ok(skipped.includes("application/vnd.google-apps.document"));
    assert.ok(skipped.includes("unsafe id (ignored)"));
    const report = read(root, "data/drive-report.md");
    assert.match(report, /"source": "drive"/);
    assert.match(report, /Shortcut to papers/);
    assert.match(report, /Thermal notes/);

    // Mirror: only small, visible PDFs; quota failure and 25 MB file have no localUrl.
    const docs = readJson(root, "src/data/generated/archive.json");
    const byId = Object.fromEntries(docs.map((d) => [d.driveFileId, d]));
    assert.equal(byId[IDS.thermalNov2021].localUrl, `/files/${IDS.thermalNov2021}.pdf`);
    assert.equal(byId[IDS.keyed].localUrl, `/files/${IDS.keyed}.pdf`);
    assert.equal(byId[IDS.keyed].resourceKey, RESOURCE_KEYS[IDS.keyed]);
    assert.equal(byId[IDS.quota].localUrl, undefined);
    assert.equal(byId[IDS.thermalJan2023].localUrl, undefined);
    assert.ok(!mock.state.downloads.has(IDS.thermalJan2023), "25 MB file must not be downloaded");
    assert.match(r.out, /downloadQuotaExceeded/);

    // Hidden kind (Data Book) is not published, not downloaded, not in public/files.
    assert.equal(byId[IDS.dataBook], undefined);
    assert.ok(!mock.state.downloads.has(IDS.dataBook));
    const published = readdirSync(join(root, "public/files")).sort();
    assert.deepEqual(published, [`${IDS.keyed}.pdf`, `${IDS.thermalNov2021}.pdf`].sort());
    assert.ok(!published.includes("STALEfile000001.pdf"), "stale mirrored copies are removed");

    // The API key never ends up in a file or in the log.
    assert.ok(!r.out.includes(KEY), "key printed to the log");
    for (const file of allFiles(root)) {
      assert.ok(!readFileSync(file).includes(KEY), `key found in ${file}`);
    }
  } finally {
    await mock.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("drive: mirror only downloads new or changed files", async () => {
  const mock = await startMockGoogle({ apiKey: KEY });
  const root = makeRoot();
  try {
    assert.equal((await run("drive-index.mjs", root, driveEnv(mock))).code, 0);
    assert.equal(mock.state.downloads.get(IDS.thermalNov2021), 1);
    assert.equal(mock.state.downloads.get(IDS.keyed), 1);

    assert.equal((await run("drive-index.mjs", root, driveEnv(mock))).code, 0);
    assert.equal(mock.state.downloads.get(IDS.thermalNov2021), 1, "unchanged file re-downloaded");
    assert.equal(mock.state.downloads.get(IDS.keyed), 1);

    const file = mock.state.tree.FOLDERscheme201.find((f) => f.id === IDS.thermalNov2021);
    file.modifiedTime = "2026-02-02T00:00:00.000Z";
    assert.equal((await run("drive-index.mjs", root, driveEnv(mock))).code, 0);
    assert.equal(mock.state.downloads.get(IDS.thermalNov2021), 2, "changed file not re-downloaded");
    assert.equal(mock.state.downloads.get(IDS.keyed), 1);
    assert.equal(
      readdirSync(join(root, ".cache/files")).filter((f) => f.startsWith(IDS.thermalNov2021))
        .length,
      1,
    );
  } finally {
    await mock.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("drive: a crawled document matches the fixture-mode document for the same file", async () => {
  const mock = await startMockGoogle({ apiKey: KEY });
  const crawlRoot = makeRoot();
  const fixtureRoot = makeRoot();
  try {
    assert.equal((await run("drive-index.mjs", crawlRoot, driveEnv(mock))).code, 0);
    assert.equal((await run("drive-index.mjs", fixtureRoot, {}, ["--fixture"])).code, 0);
    const pick = (root) => {
      const doc = readJson(root, "src/data/generated/archive.json").find(
        (d) => d.driveFileId === IDS.thermalNov2021,
      );
      const { localUrl, updatedAt, ...rest } = doc;
      return rest;
    };
    assert.deepEqual(pick(crawlRoot), pick(fixtureRoot));
  } finally {
    await mock.close();
    rmSync(crawlRoot, { recursive: true, force: true });
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Drive guards
// ---------------------------------------------------------------------------

test("drive guard: 0 files fails and keeps the previous snapshot", async () => {
  const mock = await startMockGoogle({ apiKey: KEY, empty: true });
  const root = makeRoot();
  try {
    const before = seedDriveSnapshot(root, 4);
    const r = await run("drive-index.mjs", root, driveEnv(mock));
    assert.equal(r.code, 1);
    assert.match(r.out, /0 files/);
    assert.equal(read(root, "data/drive-files.json"), before);
    assert.ok(!existsSync(join(root, "src/data/generated/archive.json")));
  } finally {
    await mock.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("drive guard: shrinking below half of the previous crawl fails unless allowed", async () => {
  const mock = await startMockGoogle({ apiKey: KEY });
  const root = makeRoot();
  try {
    const before = seedDriveSnapshot(root, 20); // the mock has 5 files
    const r = await run("drive-index.mjs", root, driveEnv(mock));
    assert.equal(r.code, 1);
    assert.match(r.out, /less than half/);
    assert.equal(read(root, "data/drive-files.json"), before);

    const ok = await run("drive-index.mjs", root, driveEnv(mock, { ARCHIVE_ALLOW_SHRINK: "1" }));
    assert.equal(ok.code, 0, ok.out);
    assert.equal(readJson(root, "data/drive-files.json").files.length, 5);
  } finally {
    await mock.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("drive guard: a folder that keeps failing fails the run (no partial archive)", async () => {
  const mock = await startMockGoogle({ apiKey: KEY, broken: true });
  const root = makeRoot();
  try {
    const before = seedDriveSnapshot(root, 4);
    for (const extra of [{}, { DEPLOY: "1" }]) {
      const r = await run("drive-index.mjs", root, driveEnv(mock, extra));
      assert.equal(r.code, 1, r.out);
      assert.match(r.out, /list Broken: HTTP 500/);
      // It was retried (6 attempts) before giving up.
      assert.ok((r.out.match(/list Broken: HTTP 500, retrying/g) ?? []).length >= 5);
      assert.equal(read(root, "data/drive-files.json"), before);
    }
  } finally {
    await mock.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("drive guard: DEPLOY=1 without credentials fails instead of reusing a snapshot", async () => {
  const root = makeRoot();
  try {
    seedDriveSnapshot(root, 4);
    const r = await run("drive-index.mjs", root, { DEPLOY: "1" });
    assert.equal(r.code, 1);
    assert.match(r.out, /GOOGLE_API_KEY/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

function sheetEnv(mock, extra = {}) {
  return {
    SHEET_TEAM_CSV: mock.sheetUrl("team"),
    SHEET_ACHIEVEMENTS_CSV: mock.sheetUrl("achievements"),
    SHEET_PLACEMENTS_CSV: mock.sheetUrl("placements"),
    SHEET_SETTINGS_CSV: mock.sheetUrl("settings"),
    ...extra,
  };
}

function serveFixtureSheets(mock) {
  for (const tab of TABS) {
    mock.state.sheets[tab] = {
      status: 200,
      body: readFileSync(join(REPO, `scripts/fixtures/sheet-sample/${tab}.csv`), "utf8"),
    };
  }
}

test("sheets: normal tabs become source=sheet", async () => {
  const mock = await startMockGoogle();
  const root = makeRoot();
  try {
    serveFixtureSheets(mock);
    const r = await run("sheet-sync.mjs", root, sheetEnv(mock, { DEPLOY: "1" }));
    assert.equal(r.code, 0, r.out);
    for (const tab of TABS)
      assert.equal(readJson(root, `src/data/generated/${tab}.json`).source, "sheet");
    assert.match(read(root, "data/sheet-report.md"), /"source": "sheet"/);
  } finally {
    await mock.close();
    rmSync(root, { recursive: true, force: true });
  }
});

for (const [label, cfg] of [
  ["an empty body", { status: 200, body: "" }],
  ["HTTP 500", { status: 500, body: "oops" }],
  [
    "an HTML login page",
    { status: 200, body: "<!doctype html><title>Sign in</title>", type: "text/html" },
  ],
]) {
  test(`sheets: ${label} never overwrites a good snapshot (fails under DEPLOY=1)`, async () => {
    const mock = await startMockGoogle();
    const root = makeRoot();
    try {
      serveFixtureSheets(mock);
      assert.equal((await run("sheet-sync.mjs", root, sheetEnv(mock))).code, 0);
      const before = read(root, "src/data/generated/team.json");

      mock.state.sheets.team = cfg;
      const lenient = await run("sheet-sync.mjs", root, sheetEnv(mock));
      assert.equal(lenient.code, 0, lenient.out);
      assert.match(lenient.out, /team: fetch failed/);
      assert.equal(read(root, "src/data/generated/team.json"), before);
      assert.match(read(root, "data/sheet-report.md"), /latest fetch failed/);

      const strict = await run("sheet-sync.mjs", root, sheetEnv(mock, { DEPLOY: "1" }));
      assert.equal(strict.code, 1, strict.out);
      assert.equal(read(root, "src/data/generated/team.json"), before);
    } finally {
      await mock.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("sheets: a tab losing more than half its rows fails under DEPLOY=1, warns otherwise", async () => {
  const mock = await startMockGoogle();
  const root = makeRoot();
  try {
    serveFixtureSheets(mock);
    assert.equal((await run("sheet-sync.mjs", root, sheetEnv(mock))).code, 0);
    const before = read(root, "src/data/generated/team.json");
    assert.equal(JSON.parse(before).items.length, 6);

    mock.state.sheets.team = {
      status: 200,
      body: "name,role,group,photo,linkedin,email_public,order,visible\nOnly One,Role,Core,,,,1,TRUE\n",
    };
    const strict = await run("sheet-sync.mjs", root, sheetEnv(mock, { DEPLOY: "1" }));
    assert.equal(strict.code, 1);
    assert.match(strict.out, /less than half/);
    assert.equal(read(root, "src/data/generated/team.json"), before);

    const lenient = await run("sheet-sync.mjs", root, sheetEnv(mock));
    assert.equal(lenient.code, 0);
    assert.match(lenient.out, /less than half/);
    assert.equal(readJson(root, "src/data/generated/team.json").items.length, 1);
  } finally {
    await mock.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("sheets: DEPLOY=1 with a missing SHEET_*_CSV fails", async () => {
  const mock = await startMockGoogle();
  const root = makeRoot();
  try {
    serveFixtureSheets(mock);
    const env = sheetEnv(mock, { DEPLOY: "1" });
    delete env.SHEET_SETTINGS_CSV;
    const r = await run("sheet-sync.mjs", root, env);
    assert.equal(r.code, 1);
    assert.match(r.out, /SHEET_SETTINGS_CSV is not set/);
  } finally {
    await mock.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("mock server is test-only: nothing in src imports it", () => {
  const hits = allFiles(join(REPO, "src")).filter(
    (f) => /\.(ts|tsx)$/.test(f) && readFileSync(f, "utf8").includes("mock-google"),
  );
  assert.deepEqual(hits, []);
  assert.ok(statSync(join(REPO, "scripts/tests/mock-google.mjs")).isFile());
});
