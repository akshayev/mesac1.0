#!/usr/bin/env node
// Builds src/data/generated/{team,achievements,placements,settings}.json from a Google Sheet.
//
// Each tab is "published to the web" as CSV (File > Share > Publish to web > pick the tab > CSV), and its URL
// goes in an env var: SHEET_TEAM_CSV, SHEET_ACHIEVEMENTS_CSV, SHEET_PLACEMENTS_CSV, SHEET_SETTINGS_CSV.
// No API key.
//
// Per tab:  env URL set -> fetch it (fall back to the existing snapshot if the fetch fails)
//           no env URL  -> keep the committed snapshot; if there is none, build from scripts/fixtures/sheet-sample/
// A bad row or a bad image never fails the build; it is skipped and listed in data/sheet-report.md.
// `--fixture` rebuilds every tab from the sample CSVs.
//
// Safety: a failed, empty, HTML or HTTP-error response never overwrites a snapshot. With DEPLOY=1 the run fails
// (exit 1) when a SHEET_*_CSV variable is missing, a tab cannot be fetched, or a tab has fewer than half the
// rows of its previous real snapshot (without DEPLOY those are warnings; SHEET_ALLOW_SHRINK=1 allows a deliberate drop).
// Overrides for tests: MESAC_PROJECT_ROOT, RETRY_BASE_MS.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TABS } from "./lib/sheet.mjs";

const ROOT = process.env.MESAC_PROJECT_ROOT
  ? resolve(process.env.MESAC_PROJECT_ROOT)
  : join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "src/data/generated");
const FIXTURE_DIR = join(ROOT, "scripts/fixtures/sheet-sample");
const REPORT = join(ROOT, "data/sheet-report.md");

if (existsSync(join(ROOT, ".env"))) process.loadEnvFile(join(ROOT, ".env"));

const useFixture = process.argv.includes("--fixture");
const DEPLOYING = ["1", "true"].includes(String(process.env.DEPLOY ?? "").toLowerCase());
const RETRY_BASE_MS = Number(process.env.RETRY_BASE_MS) || 800;
const ALLOW_SHRINK = ["1", "true"].includes(
  String(process.env.SHEET_ALLOW_SHRINK ?? "").toLowerCase(),
);
const countOf = (items) => (Array.isArray(items) ? items.length : Object.keys(items ?? {}).length);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const snapshotPath = (tab) => join(OUT_DIR, `${tab}.json`);

function writeIfChanged(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path) && readFileSync(path, "utf8") === content) return false;
  writeFileSync(path, content);
  return true;
}

function readSnapshot(tab) {
  try {
    return JSON.parse(readFileSync(snapshotPath(tab), "utf8"));
  } catch {
    return null;
  }
}

/** Fetch published CSV with a timeout and retries. Never includes the URL in errors (it is not a secret, but needless noise). */
async function fetchCsv(url, tab) {
  let lastError = "unknown error";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get("content-type") ?? "";
      const body = await res.text();
      if (body.trim() === "") throw new Error("empty response");
      if (/text\/html/i.test(type) || /^\s*<(!doctype|html)/i.test(body)) {
        throw new Error("got a web page, not CSV (is the tab published to the web as CSV?)");
      }
      return body;
    } catch (err) {
      lastError = err.name === "TimeoutError" ? "timed out" : err.message;
      if (attempt < 2) await sleep(2 ** attempt * RETRY_BASE_MS);
    }
  }
  throw new Error(`${tab}: ${lastError}`);
}

/**
 * Returns { snapshot, write, problem }:
 *   snapshot  what the site should use for this tab
 *   write     true only for fresh, trusted data (a failure never touches the existing file)
 *   problem   a message that fails the run under DEPLOY=1 (and is a warning otherwise)
 */
async function buildTab(tab) {
  const { env, normalize } = TABS[tab];
  const url = process.env[env]?.trim();
  const existing = readSnapshot(tab);

  if (!useFixture && url) {
    try {
      const { items, issues } = normalize(await fetchCsv(url, tab));
      const snapshot = { source: "sheet", generatedAt: new Date().toISOString(), issues, items };
      const prev = existing?.source === "sheet" ? countOf(existing.items) : 0;
      const now = countOf(items);
      console.log(`  ${tab}: fetched from sheet (${now} entries)`);
      if (prev > 0 && now < prev * 0.5) {
        const problem = `${tab}: only ${now} entries, less than half of the previous ${prev}`;
        if (DEPLOYING && !ALLOW_SHRINK) {
          // Keep the old snapshot; the run fails below.
          return { snapshot: existing, write: false, problem };
        }
        console.warn(
          `  ${problem} (using the new data${ALLOW_SHRINK ? ", SHEET_ALLOW_SHRINK is set" : "; this fails when DEPLOY=1"})`,
        );
        snapshot.issues = [...issues, { tab, line: 0, level: "warn", message: problem }];
      }
      return { snapshot, write: true, problem: null };
    } catch (err) {
      const problem = `${tab}: fetch failed (${err.message})`;
      console.warn(`  ${problem}; keeping the previous snapshot`);
      if (existing) {
        const note = {
          tab,
          line: 0,
          level: "error",
          message: `latest fetch failed: ${err.message}`,
        };
        // Report the failure, but leave the snapshot file exactly as it was.
        return {
          snapshot: { ...existing, issues: [...(existing.issues ?? []), note] },
          write: false,
          problem,
        };
      }
      return { ...fixtureTab(tab, normalize), problem };
    }
  }

  if (!useFixture && DEPLOYING) {
    const problem = `${tab}: ${env} is not set`;
    if (existing) return { snapshot: existing, write: false, problem };
    return { ...fixtureTab(tab, normalize), problem };
  }
  if (!useFixture && existing) {
    console.log(`  ${tab}: no ${env}, keeping committed snapshot (source: ${existing.source})`);
    return { snapshot: existing, write: false, problem: null };
  }
  return { ...fixtureTab(tab, normalize), problem: null };
}

function fixtureTab(tab, normalize) {
  const { items, issues } = normalize(readFileSync(join(FIXTURE_DIR, `${tab}.csv`), "utf8"));
  console.log(`  ${tab}: using sample fixture (${countOf(items)} entries)`);
  return { snapshot: { source: "fixture", generatedAt: null, issues, items }, write: true };
}

function writeReport(snapshots) {
  const tabs = Object.keys(snapshots);
  const allSheet = tabs.every((t) => snapshots[t].source === "sheet");
  const summary = {
    source: allSheet ? "sheet" : "fixture",
    tabs: Object.fromEntries(tabs.map((t) => [t, snapshots[t].source])),
    generatedAt:
      tabs
        .map((t) => snapshots[t].generatedAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null,
    counts: Object.fromEntries(
      tabs.map((t) => [
        t,
        Array.isArray(snapshots[t].items)
          ? snapshots[t].items.length
          : Object.keys(snapshots[t].items).length,
      ]),
    ),
  };
  const lines = [
    "# Sheet report",
    "",
    "Generated by `npm run data:sheet`. Do not edit by hand.",
    "",
    "```json",
    JSON.stringify(summary, null, 2),
    "```",
    "",
  ];
  if (!allSheet) {
    const sample = tabs.filter((t) => snapshots[t].source !== "sheet").join(", ");
    lines.push(
      `> **Sample data** in: ${sample}. Set the \`SHEET_*_CSV\` env vars (see \`.env.example\`) and run \`npm run data:sheet\`.`,
      "",
    );
  }
  lines.push("## Skipped rows and warnings", "");
  const issues = tabs.flatMap((t) =>
    (snapshots[t].issues ?? []).map((i) => ({ ...i, tab: i.tab ?? t })),
  );
  if (issues.length === 0) {
    lines.push("_None._", "");
  } else {
    lines.push("| Tab | Line | Level | Problem |", "| --- | --- | --- | --- |");
    for (const i of issues) {
      lines.push(
        `| ${i.tab} | ${i.line || "-"} | ${i.level} | ${String(i.message).replace(/\|/g, "\\|")} |`,
      );
    }
    lines.push("");
  }
  writeIfChanged(REPORT, lines.join("\n"));
  return summary;
}

async function main() {
  console.log("data:sheet:");
  const snapshots = {};
  const problems = [];
  for (const tab of Object.keys(TABS)) {
    const { snapshot, write, problem } = await buildTab(tab);
    snapshots[tab] = snapshot;
    if (write) writeIfChanged(snapshotPath(tab), `${JSON.stringify(snapshot, null, 2)}\n`);
    if (problem) problems.push(problem);
  }
  const s = writeReport(snapshots);
  console.log(
    `data:sheet: source=${s.source} -> src/data/generated/{${Object.keys(TABS).join(",")}}.json`,
  );
  if (problems.length && DEPLOYING) {
    throw new Error(
      `refusing to continue with DEPLOY set:\n  - ${problems.join("\n  - ")}\nThe previous snapshots were kept.`,
    );
  }
}

main().catch((err) => {
  console.error(`data:sheet failed: ${err.message}`);
  process.exit(1);
});
