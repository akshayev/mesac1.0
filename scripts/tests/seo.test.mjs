import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PLACEHOLDER_SITE_URL,
  buildRobots,
  buildSitemap,
  isPlaceholderSiteUrl,
  normalizeSiteUrl,
  staticPathsFromRouteTree,
  xmlEscape,
} from "../lib/seo.mjs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const seo = JSON.parse(read("../../src/data/seo.json"));

test("normalizeSiteUrl", () => {
  assert.equal(normalizeSiteUrl("https://mesac.pages.dev/"), "https://mesac.pages.dev");
  assert.equal(
    normalizeSiteUrl("mesac-cusat.example.workers.dev"),
    "https://mesac-cusat.example.workers.dev",
  );
  assert.equal(normalizeSiteUrl(""), PLACEHOLDER_SITE_URL);
  assert.equal(normalizeSiteUrl(undefined), PLACEHOLDER_SITE_URL);
  assert.equal(normalizeSiteUrl("http://[bad"), PLACEHOLDER_SITE_URL);
});

test("isPlaceholderSiteUrl", () => {
  assert.equal(isPlaceholderSiteUrl(""), true);
  assert.equal(isPlaceholderSiteUrl("https://mesac.example"), true);
  assert.equal(isPlaceholderSiteUrl("https://mesac.example/"), true);
  assert.equal(isPlaceholderSiteUrl("https://real.example.org"), false);
});

test("xmlEscape", () => {
  assert.equal(xmlEscape(`a&b<c>"d'`), "a&amp;b&lt;c&gt;&quot;d&apos;");
});

test("static paths come from the real route tree, minus dynamic routes, aliases and redirects", () => {
  const paths = staticPathsFromRouteTree(read("../../src/routeTree.gen.ts"), seo);
  for (const p of [
    "/",
    "/archive",
    "/about-mesac",
    "/about-mesac/team",
    "/placements",
    "/alumni",
    "/contact",
  ]) {
    assert.ok(paths.includes(p), `missing ${p}`);
  }
  for (const p of ["/about", "/team", "/downloads", "/archive/$documentId"]) {
    assert.ok(!paths.includes(p), `should not include ${p}`);
  }
  assert.ok(
    paths.every((p) => !p.includes("$") && !p.endsWith("_")),
    paths.join(","),
  );
});

test("sitemap lists pages and every document, with lastmod when known", () => {
  const xml = buildSitemap({
    siteUrl: "https://example.org/",
    paths: ["/", "/archive"],
    docs: [{ id: "s5-a-1AbC", updatedAt: "2025-03-04T10:00:00Z" }, { id: "s5-b&c" }],
  });
  assert.match(xml, /<loc>https:\/\/example\.org\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.org\/archive<\/loc>/);
  assert.match(
    xml,
    /<loc>https:\/\/example\.org\/archive\/s5-a-1AbC<\/loc>\s*<lastmod>2025-03-04<\/lastmod>/,
  );
  assert.match(xml, /archive\/s5-b%26c</);
  assert.equal((xml.match(/<url>/g) ?? []).length, 4);
});

test("robots.txt points at the sitemap", () => {
  assert.match(buildRobots("https://example.org"), /Sitemap: https:\/\/example\.org\/sitemap\.xml/);
});

test("every archive document id in the committed data is URL-safe", () => {
  const docs = JSON.parse(read("../../src/data/generated/archive.json"));
  for (const d of docs) assert.equal(encodeURIComponent(d.id), d.id);
});
