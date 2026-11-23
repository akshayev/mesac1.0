#!/usr/bin/env node
// Builds src/data/generated/archive.json from the "Mesac-Academics" Google Drive folder.
//
//   npm run data:archive              crawl Drive if GOOGLE_API_KEY / GOOGLE_SERVICE_ACCOUNT_JSON is set,
//                                     otherwise reuse the committed snapshot (data/drive-files.json)
//   npm run data:archive -- --fixture ignore the snapshot and rebuild from scripts/fixtures/drive-sample.json
//
// Pipeline: file list (crawl | snapshot | fixture) -> parse -> overrides -> archive.json + report.
// The file list is saved to data/drive-files.json so builds without a key produce the same output.
// Never logs API keys or resource keys.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  statSync,
  readdirSync,
  rmSync,
  renameSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDocument, clean, isMesacOwner, maskEmail } from "./lib/parse.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = {
  env: join(ROOT, ".env"),
  fixture: join(ROOT, "scripts/fixtures/drive-sample.json"),
  snapshot: join(ROOT, "data/drive-files.json"),
  report: join(ROOT, "data/drive-report.md"),
  unsorted: join(ROOT, "data/unsorted.csv"),
  subjects: join(ROOT, "src/data/subjects.json"),
  overrides: join(ROOT, "src/data/archive-overrides.json"),
  out: join(ROOT, "src/data/generated/archive.json"),
  publicFiles: join(ROOT, "public/files"),
  cache: join(ROOT, ".cache/files"),
};

const MIRROR_MAX_BYTES = 20 * 1024 * 1024;
const CONCURRENCY = 4;
const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";
const FIELDS = "id,name,mimeType,size,modifiedTime,owners(emailAddress),resourceKey,parents";

if (existsSync(P.env)) process.loadEnvFile(P.env);

const args = new Set(process.argv.slice(2));
const API_KEY = process.env.GOOGLE_API_KEY?.trim() || "";
const SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() || "";
const ROOT_ID = process.env.DRIVE_ROOT_ID?.trim() || "1O_Q5coUAKKpSu3Egmz5YOu9MzdPxyiR6";
const HAS_CREDENTIALS = Boolean(API_KEY || SA_JSON);

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function writeIfChanged(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path) && readFileSync(path, "utf8") === content) return false;
  writeFileSync(path, content);
  return true;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Drive API (key mode)
// ---------------------------------------------------------------------------

let bearerToken = "";
async function authHeaders(resourceKeys = []) {
  const h = {};
  if (SA_JSON) {
    if (!bearerToken) {
      let GoogleAuth;
      try {
        ({ GoogleAuth } = await import("google-auth-library"));
      } catch {
        throw new Error(
          "GOOGLE_SERVICE_ACCOUNT_JSON is set but google-auth-library is not installed. Run `npm i -D google-auth-library` or use GOOGLE_API_KEY.",
        );
      }
      const auth = new GoogleAuth({
        credentials: JSON.parse(SA_JSON),
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
      });
      bearerToken = (await (await auth.getClient()).getAccessToken()).token;
    }
    h.Authorization = `Bearer ${bearerToken}`;
  }
  const keys = resourceKeys.filter((r) => r.resourceKey).map((r) => `${r.id}/${r.resourceKey}`);
  if (keys.length) h["X-Goog-Drive-Resource-Keys"] = keys.join(",");
  return h;
}

function apiUrl(path, params) {
  const u = new URL(`https://www.googleapis.com/drive/v3/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  if (!SA_JSON && API_KEY) u.searchParams.set("key", API_KEY);
  return u;
}

/** fetch with exponential backoff on 403 (rate limit), 429 and 5xx. `label` is what gets logged. */
async function fetchWithRetry(url, headers, label, attempts = 6) {
  for (let i = 0; ; i++) {
    let res;
    try {
      res = await fetch(url, { headers });
    } catch (err) {
      if (i >= attempts - 1) throw new Error(`${label}: network error (${err.code ?? err.name})`);
      await sleep(2 ** i * 500 + Math.random() * 300);
      continue;
    }
    if (res.ok) return res;
    const body = await res.text().catch(() => "");
    const rateLimited =
      res.status === 429 ||
      res.status >= 500 ||
      (res.status === 403 && /rateLimitExceeded|userRateLimitExceeded|backendError/i.test(body));
    if (!rateLimited || i >= attempts - 1) {
      const reason = /"reason":\s*"([^"]+)"/.exec(body)?.[1] ?? "";
      throw new Error(`${label}: HTTP ${res.status} ${reason}`.trim());
    }
    const wait = 2 ** i * 500 + Math.random() * 300;
    console.warn(`  ${label}: HTTP ${res.status}, retrying in ${Math.round(wait)} ms`);
    await sleep(wait);
  }
}

async function listChildren(folder) {
  const out = [];
  let pageToken = "";
  do {
    const params = {
      q: `'${folder.id}' in parents and trashed = false`,
      fields: `nextPageToken,files(${FIELDS})`,
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    };
    if (pageToken) params.pageToken = pageToken;
    const res = await fetchWithRetry(
      apiUrl("files", params),
      await authHeaders([folder]),
      `list ${folder.path.join("/") || "(root)"}`,
    );
    const json = await res.json();
    out.push(...(json.files ?? []));
    pageToken = json.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

async function crawl() {
  const files = [];
  const skipped = [];
  let level = [{ id: ROOT_ID, path: [], resourceKey: "" }];
  let folders = 0;
  while (level.length) {
    folders += level.length;
    const children = await mapLimit(level, CONCURRENCY, listChildren);
    const nextLevel = [];
    level.forEach((folder, i) => {
      for (const f of children[i]) {
        const path = [...folder.path, f.name];
        if (f.mimeType === FOLDER_MIME) {
          nextLevel.push({ id: f.id, path, resourceKey: f.resourceKey ?? "" });
        } else if (
          f.mimeType === SHORTCUT_MIME ||
          f.mimeType.startsWith("application/vnd.google-apps.")
        ) {
          skipped.push({ path: path.map(clean).join("/"), mimeType: f.mimeType });
        } else {
          const owner = f.owners?.[0]?.emailAddress ?? "";
          files.push({
            path,
            id: f.id,
            size: Number(f.size ?? 0),
            mimeType: f.mimeType,
            modifiedTime: f.modifiedTime,
            owner: owner && !isMesacOwner(owner) ? maskEmail(owner) : null,
            ownerKnown: Boolean(owner),
            ...(f.resourceKey ? { resourceKey: f.resourceKey } : {}),
          });
        }
      }
    });
    level = nextLevel;
  }
  console.log(`  crawled ${folders} folders, ${files.length} files, ${skipped.length} skipped`);
  return { files, skipped };
}

// ---------------------------------------------------------------------------
// Mirror (key mode only)
// ---------------------------------------------------------------------------

async function mirror(docs, filesById) {
  mkdirSync(P.cache, { recursive: true });
  mkdirSync(P.publicFiles, { recursive: true });
  const candidates = docs.filter((d) => {
    const f = filesById.get(d.driveFileId);
    const isPdf = f.mimeType === "application/pdf" || /\.pdf$/i.test(f.path.at(-1));
    return isPdf && f.size > 0 && f.size < MIRROR_MAX_BYTES;
  });
  let fetched = 0;
  let reused = 0;
  let failed = 0;
  await mapLimit(candidates, CONCURRENCY, async (d) => {
    const f = filesById.get(d.driveFileId);
    const stamp = String(f.modifiedTime ?? "").replace(/[^0-9]/g, "") || "0";
    const cacheName = `${f.id}-${stamp}.pdf`;
    const cached = join(P.cache, cacheName);
    const target = join(P.publicFiles, `${f.id}.pdf`);
    try {
      if (!existsSync(cached)) {
        const res = await fetchWithRetry(
          apiUrl(`files/${f.id}`, { alt: "media", supportsAllDrives: "true" }),
          await authHeaders([f]),
          `download ${d.sourcePath}`,
        );
        const tmp = `${cached}.part`;
        writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
        renameSync(tmp, cached);
        // Drop stale cache entries for this file.
        for (const old of readdirSync(P.cache)) {
          if (old.startsWith(`${f.id}-`) && old !== cacheName)
            rmSync(join(P.cache, old), { force: true });
        }
        fetched++;
      } else {
        reused++;
      }
      if (!existsSync(target) || statSync(target).size !== statSync(cached).size) {
        copyFileSync(cached, target);
      }
    } catch (err) {
      failed++;
      console.warn(`  mirror failed: ${err.message}`);
    }
  });
  console.log(
    `  mirror: ${fetched} downloaded, ${reused} cached, ${failed} failed (of ${candidates.length})`,
  );
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

function loadFixture() {
  const { files } = readJson(P.fixture, { files: [] });
  return {
    source: "fixture",
    generatedAt: null,
    rootId: ROOT_ID,
    files: files.map((f) => ({
      path: f.path.split("/"),
      id: f.id,
      size: f.size,
      mimeType: "application/pdf",
      modifiedTime: null,
      owner: f.owner && !isMesacOwner(f.owner) ? maskEmail(f.owner) : null,
      ownerKnown: true,
    })),
    skipped: [],
  };
}

async function getSnapshot() {
  if (HAS_CREDENTIALS) {
    console.log(`data:archive: crawling Drive (${SA_JSON ? "service account" : "API key"})`);
    const { files, skipped } = await crawl();
    return {
      source: "drive",
      generatedAt: new Date().toISOString(),
      rootId: ROOT_ID,
      files,
      skipped,
    };
  }
  if (!args.has("--fixture") && existsSync(P.snapshot)) {
    const snap = readJson(P.snapshot);
    console.log(
      `data:archive: no Google credentials, reusing committed snapshot (source: ${snap.source})`,
    );
    return snap;
  }
  console.log("data:archive: no Google credentials, using scripts/fixtures/drive-sample.json");
  return loadFixture();
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

const TYPE_ORDER = [
  "question_paper",
  "internal_paper",
  "syllabus",
  "notes",
  "lab_manual",
  "gate_paper",
];
const semRank = (s) => (typeof s === "number" ? s : 99);
const MONTH_ORDER = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const monthRank = (m) => MONTH_ORDER.indexOf(m);

function buildArchive(snapshot) {
  const subjects = readJson(P.subjects, []);
  const overrides = readJson(P.overrides, {});
  const docs = [];
  const hidden = [];
  const unsorted = [];
  const unparsed = [];
  const unmatched = new Map();
  const confirm = new Set(
    subjects.filter((s) => s.confirm).map((s) => `S${s.semester} · ${s.name}`),
  );
  const foreignOwners = [];
  const seenIds = new Set();

  for (const file of snapshot.files) {
    const { doc, meta } = buildDocument(file, subjects);
    if (file.owner) foreignOwners.push({ path: doc.sourcePath, owner: file.owner });
    if (!meta.kind) {
      unsorted.push({ reason: "unknown folder layout", file, doc });
      continue;
    }
    if (meta.unparsed) {
      unparsed.push(doc.sourcePath);
      unsorted.push({ reason: "file name not parsed", file, doc });
    }
    if (meta.unmatchedSubject) {
      unmatched.set(meta.unmatchedSubject, (unmatched.get(meta.unmatchedSubject) ?? 0) + 1);
      unsorted.push({ reason: "subject not in subjects.json", file, doc });
    }

    const o = overrides[file.id];
    let isHidden = meta.hidden;
    if (o) {
      const { hide, ...fields } = o;
      Object.assign(doc, fields);
      if (typeof hide === "boolean") isHidden = hide;
    }
    if (isHidden) {
      hidden.push(doc);
      continue;
    }

    let id = doc.id;
    for (let n = 7; seenIds.has(id); n++)
      id = `${doc.id.replace(/-[^-]+$/, "")}-${file.id.slice(0, n)}`;
    doc.id = id;
    seenIds.add(id);

    if (existsSync(join(P.publicFiles, `${file.id}.pdf`))) doc.localUrl = `/files/${file.id}.pdf`;
    docs.push(doc);
  }

  docs.sort(
    (a, b) =>
      semRank(a.semester) - semRank(b.semester) ||
      a.subject.localeCompare(b.subject) ||
      TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
      b.examYear - a.examYear ||
      monthRank(b.examMonth) - monthRank(a.examMonth) ||
      a.title.localeCompare(b.title),
  );

  return { docs, hidden, unsorted, unparsed, unmatched, confirm, foreignOwners };
}

function countBy(items, key) {
  const m = new Map();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()];
}

function writeReport(snapshot, r) {
  const ownersKnown = snapshot.files.some((f) => f.ownerKnown);
  const summary = {
    source: snapshot.source,
    generatedAt: snapshot.generatedAt,
    files: snapshot.files.length,
    visible: r.docs.length,
    hidden: r.hidden.length,
    unsorted: r.unsorted.length,
    skippedGoogleTypes: snapshot.skipped.length,
  };
  const lines = [
    "# Drive archive report",
    "",
    "Generated by `npm run data:archive`. Do not edit by hand.",
    "",
    "```json",
    JSON.stringify(summary, null, 2),
    "```",
    "",
  ];
  if (snapshot.source === "fixture") {
    lines.push(
      "> **Sample data.** Built from `scripts/fixtures/drive-sample.json`, not a real crawl. Set `GOOGLE_API_KEY` and run `npm run data:archive`.",
      "",
    );
  }

  const table = (title, rows, head = ["", "Count"]) => {
    lines.push(`## ${title}`, "");
    if (!rows.length) return lines.push("_None._", "");
    lines.push(`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`);
    for (const row of rows) lines.push(`| ${row.join(" | ")} |`);
    lines.push("");
  };

  const semLabel = (s) => (typeof s === "number" ? `S${s}` : String(s || "—"));
  table(
    "Visible documents per semester",
    countBy(r.docs, (d) => semLabel(d.semester)),
    ["Semester", "Count"],
  );
  table(
    "Visible documents per kind",
    countBy(r.docs, (d) => d.type),
    ["Kind", "Count"],
  );
  table(
    "Visible documents per subject",
    countBy(r.docs, (d) => `${semLabel(d.semester)} · ${d.subject}`).sort((a, b) =>
      a[0].localeCompare(b[0]),
    ),
    ["Subject", "Count"],
  );
  table(
    "Unparsed file names",
    r.unparsed.map((p) => [`\`${p}\``]),
    ["Path"],
  );
  table(
    "Unmatched subject folders (add to subjects.json aliases)",
    [...r.unmatched.entries()],
    ["Folder", "Files"],
  );
  table(
    "Subject names to confirm (marked confirm: true in subjects.json)",
    [...r.confirm].map((s) => [s]),
    ["Subject"],
  );
  table(
    "Files not owned by mesacusatacademy@gmail.com",
    r.foreignOwners.map((f) => [`\`${f.path}\``, f.owner]),
    ["Path", "Owner (masked)"],
  );
  if (!ownersKnown && snapshot.source === "drive") {
    lines.push(
      "> Drive returned no owner info for this crawl, so the owner check above is incomplete.",
      "",
    );
  }
  table(
    "Hidden files (enable with archive-overrides.json `hide: false`)",
    r.hidden.map((d) => [`\`${d.sourcePath}\``, d.type, d.driveFileId]),
    ["Path", "Kind", "Drive id"],
  );
  table(
    "Skipped Google Docs / shortcuts",
    snapshot.skipped.map((s) => [`\`${s.path}\``, s.mimeType]),
    ["Path", "Type"],
  );

  writeIfChanged(P.report, lines.join("\n"));

  const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    "reason,path,drive_id,size",
    ...r.unsorted.map((u) =>
      [u.reason, u.doc.sourcePath, u.file.id, u.file.size].map(csvCell).join(","),
    ),
  ].join("\n");
  writeIfChanged(P.unsorted, `${csv}\n`);
  return summary;
}

async function main() {
  const snapshot = await getSnapshot();
  writeIfChanged(P.snapshot, `${JSON.stringify(snapshot, null, 2)}\n`);

  if (HAS_CREDENTIALS) {
    const filesById = new Map(snapshot.files.map((f) => [f.id, f]));
    await mirror(buildArchive(snapshot).docs, filesById);
  }

  const result = buildArchive(snapshot);
  writeIfChanged(P.out, `${JSON.stringify(result.docs, null, 2)}\n`);
  const s = writeReport(snapshot, result);
  console.log(
    `data:archive: source=${s.source} visible=${s.visible} hidden=${s.hidden} unsorted=${s.unsorted} -> src/data/generated/archive.json`,
  );
}

main().catch((err) => {
  console.error(`data:archive failed: ${err.message}`);
  process.exit(1);
});
