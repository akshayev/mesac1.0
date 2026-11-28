#!/usr/bin/env node
// Final Cloudflare config for the build.
//
//   node scripts/render-wrangler.mjs          runs after every `npm run build` ("postbuild"). Without
//                                             D1_DATABASE_ID it does nothing (Sheet mode, as before). With it,
//                                             it adds the DB (D1), MEDIA (R2) and Access settings to
//                                             .output/server/wrangler.json. Bad values stop the build.
//   node scripts/render-wrangler.mjs --local  writes .wrangler/local/wrangler.json for `npm run dev:admin`
//                                             and the db:*:local scripts (local-only names; never deployed).
//
// MESAC_PROJECT_ROOT overrides the project folder (tests).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { isDevAdminBuild } from "./lib/build-flags.mjs";
import { renderDeployConfig, renderLocalConfig } from "./lib/wrangler-config.mjs";

const ROOT = process.env.MESAC_PROJECT_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..");
const DEPLOYING = ["1", "true"].includes(String(process.env.DEPLOY ?? "").toLowerCase());
const rel = (from, to) => relative(from, to).split("\\").join("/");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

/** wrangler.jsonc without its whole-line // comments. */
const readJsonc = (p) =>
  JSON.parse(
    readFileSync(p, "utf8")
      .split("\n")
      .filter((l) => !/^\s*\/\//.test(l))
      .join("\n"),
  );

function local() {
  const outDir = join(ROOT, ".wrangler/local");
  // A dev:admin build has no generated wrangler.json (so `wrangler deploy` can never pick it up): use the
  // checked-in settings plus the layout nitro's cloudflare-module preset always produces.
  const base = existsSync(join(ROOT, ".output-dev/server/index.mjs"))
    ? {
        ...readJsonc(join(ROOT, "wrangler.jsonc")),
        main: "index.mjs",
        assets: { binding: "ASSETS", directory: "../public" },
        no_bundle: true,
        rules: [{ type: "ESModule", globs: ["**/*.mjs", "**/*.js"] }],
      }
    : null;
  const config = renderLocalConfig(base, {
    main: base && rel(outDir, join(ROOT, ".output-dev/server/index.mjs")),
    assetsDir: base && rel(outDir, join(ROOT, ".output-dev/public")),
    migrationsDir: rel(outDir, join(ROOT, "migrations")),
  });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "wrangler.json"), `${JSON.stringify(config, null, 2)}\n`);
  console.log(
    `render-wrangler: local config -> .wrangler/local/wrangler.json${base ? "" : " (no dev build yet: database commands only)"}`,
  );
}

function deploy() {
  if (isDevAdminBuild()) {
    console.log("render-wrangler: dev:admin build, nothing to do for .output");
    return;
  }
  const file = join(ROOT, ".output/server/wrangler.json");
  const hasD1 = String(process.env.D1_DATABASE_ID ?? "").trim() !== "";
  if (!existsSync(file)) {
    if (hasD1) {
      console.error(
        "render-wrangler: .output/server/wrangler.json is missing; run the build first.",
      );
      process.exit(1);
    }
    return;
  }
  const { config, changed, errors, warnings, accessProblem } = renderDeployConfig(
    readJson(file),
    process.env,
    { migrationsDir: rel(dirname(file), join(ROOT, "migrations")) },
  );
  for (const w of warnings) console.warn(`render-wrangler: ${w}`);
  if (errors.length || (DEPLOYING && accessProblem)) {
    for (const e of errors) console.error(`render-wrangler: ${e}`);
    if (DEPLOYING && accessProblem)
      console.error("render-wrangler: refusing to deploy the dashboard without Access settings.");
    process.exit(1);
  }
  if (!changed) {
    console.log("render-wrangler: no D1_DATABASE_ID, Sheet mode (config unchanged)");
    return;
  }
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
  console.log(
    `render-wrangler: admin mode -> DB${config.r2_buckets ? ", MEDIA" : ""}${config.vars?.CF_ACCESS_AUD ? ", Access" : ""} added to .output/server/wrangler.json`,
  );
}

if (process.argv.includes("--local")) local();
else deploy();
