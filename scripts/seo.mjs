#!/usr/bin/env node
// Writes public/sitemap.xml and public/robots.txt for the current SITE_URL.
// Both files depend on SITE_URL, so they are generated on every build (npm run seo, part of "prebuild")
// and are not committed (.gitignore).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRobots,
  buildSitemap,
  isPlaceholderSiteUrl,
  normalizeSiteUrl,
  staticPathsFromRouteTree,
} from "./lib/seo.mjs";
import { joinPageEnabled } from "./lib/features.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(join(ROOT, ".env"))) process.loadEnvFile(join(ROOT, ".env"));

function writeIfChanged(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path) && readFileSync(path, "utf8") === content) return;
  writeFileSync(path, content);
}

const siteUrl = normalizeSiteUrl(process.env.SITE_URL);
const seo = JSON.parse(readFileSync(join(ROOT, "src/data/seo.json"), "utf8"));
// The public alumni form exists only when the admin database and Turnstile are configured.
if (!joinPageEnabled(process.env)) seo.exclude = [...(seo.exclude ?? []), "/alumni/join"];
const paths = staticPathsFromRouteTree(
  readFileSync(join(ROOT, "src/routeTree.gen.ts"), "utf8"),
  seo,
);
const docs = JSON.parse(readFileSync(join(ROOT, "src/data/generated/archive.json"), "utf8"));

writeIfChanged(join(ROOT, "public/sitemap.xml"), buildSitemap({ siteUrl, paths, docs }));
writeIfChanged(join(ROOT, "public/robots.txt"), buildRobots(siteUrl));

console.log(
  `seo: ${paths.length} pages + ${docs.length} archive documents -> public/sitemap.xml (${siteUrl})`,
);
if (isPlaceholderSiteUrl(process.env.SITE_URL)) {
  console.warn(
    "seo: SITE_URL is not set, using the placeholder. Set it before deploying (see .env.example).",
  );
}
