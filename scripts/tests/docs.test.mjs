// The owner documentation must name exactly the secrets and variables the code uses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const read = (rel) => readFileSync(join(REPO, rel), "utf8");
const START = read("docs/OWNERS-START-HERE.md");
const DOCS = {
  "docs/OWNERS-START-HERE.md": START,
  "HANDOVER.md": read("HANDOVER.md"),
  "docs/ADMIN-ARCHITECTURE.md": read("docs/ADMIN-ARCHITECTURE.md"),
  "docs/OWNER-DEPLOYMENT-GUIDE.md": read("docs/OWNER-DEPLOYMENT-GUIDE.md"),
  "migrations/README.md": read("migrations/README.md"),
};
const WORKFLOWS = [".github/workflows/deploy.yml", ".github/workflows/backup.yml"]
  .map(read)
  .join("\n");

/** Settings that exist only on the Worker; the deploy workflow fills them (see upload-worker-secrets, render-wrangler). */
const WORKER_ONLY = ["GITHUB_DISPATCH_TOKEN", "GITHUB_REPO", "GITHUB_WORKFLOW_FILE"];

function files(dir, re) {
  return readdirSync(join(REPO, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(join(REPO, rel)).isDirectory()) return name === "tests" ? [] : files(rel, re);
    return re.test(name) ? [rel] : [];
  });
}
// Everything the code itself mentions (tests excluded, so a name cannot exist only because a test uses it).
const CODE = [
  WORKFLOWS,
  read(".env.example"),
  ...files("scripts", /\.mjs$/).map(read),
  ...files("src", /\.(ts|tsx)$/).map(read),
].join("\n");

const reference = START.split("## Reference: every secret and variable")[1].split("\n## ")[0];
const rows = [...reference.matchAll(/^\|\s*`([A-Z0-9_]+)`\s*\|([^|]+)\|([^|]+)\|([^|]+)\|/gm)].map(
  (m) => ({
    name: m[1],
    kind: m[2].trim(),
    neededFor: m[4].trim(),
  }),
);

test("the reference table lists exactly the workflows' secrets and variables plus the Worker-only settings", () => {
  const secrets = new Set([...WORKFLOWS.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]));
  const vars = new Set([...WORKFLOWS.matchAll(/vars\.([A-Z0-9_]+)/g)].map((m) => m[1]));
  const byKind = (k) =>
    rows
      .filter((r) => r.kind === k)
      .map((r) => r.name)
      .sort();
  assert.deepEqual(byKind("GitHub secret"), [...secrets].sort());
  assert.deepEqual(byKind("GitHub variable"), [...vars].sort());
  assert.deepEqual(byKind("Worker (automatic)"), [...WORKER_ONLY].sort());
  assert.equal(
    rows.length,
    secrets.size + vars.size + WORKER_ONLY.length,
    "no other kinds or duplicates",
  );
  for (const name of WORKER_ONLY) assert.ok(CODE.includes(name), name);
  // GitHub refuses secret and variable names that start with GITHUB_.
  for (const name of [...secrets, ...vars]) assert.doesNotMatch(name, /^GITHUB_/, name);
});

test("every setting-like NAME in the owner docs exists in the code", () => {
  for (const [file, text] of Object.entries(DOCS)) {
    const names = new Set([...text.matchAll(/`([A-Z][A-Z0-9]*_[A-Z0-9_]+)`/g)].map((m) => m[1]));
    for (const name of names)
      assert.ok(CODE.includes(name), `${file}: \`${name}\` is not used anywhere in the code`);
  }
});

test("the 12 Part A secrets are the ones every deploy needs", () => {
  const partA = rows.filter((r) => r.neededFor.startsWith("Part A"));
  assert.equal(partA.length, 12, partA.map((r) => r.name).join(", "));
  assert.ok(partA.every((r) => r.kind === "GitHub secret"));
  assert.match(START, /12 Part A\s+secrets/);
  assert.match(DOCS["HANDOVER.md"], /All 12 required secrets/);
});

test("the other guides point to OWNERS-START-HERE", () => {
  for (const file of [
    "HANDOVER.md",
    "README.md",
    "docs/OWNER-DEPLOYMENT-GUIDE.md",
    "docs/ADMIN-ARCHITECTURE.md",
  ])
    assert.match(read(file), /OWNERS-START-HERE\.md/, file);
  for (const part of [
    "Part A",
    "Part B",
    "Part C",
    "Part D",
    "Part E",
    "Part F",
    "Release checklist",
    "Glossary",
  ])
    assert.ok(START.includes(part), part);
});
