// Pure helpers for sitemap.xml and robots.txt (tested in scripts/tests/seo.test.mjs).

export const PLACEHOLDER_SITE_URL = "https://mesac.example";

/** Trim, add https:// if missing, drop trailing slashes. Empty/invalid -> the placeholder. */
export function normalizeSiteUrl(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return PLACEHOLDER_SITE_URL;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    return `${u.protocol}//${u.host}${u.pathname}`.replace(/\/+$/, "");
  } catch {
    return PLACEHOLDER_SITE_URL;
  }
}

export function isPlaceholderSiteUrl(raw) {
  const s = String(raw ?? "").trim();
  return !s || normalizeSiteUrl(s) === PLACEHOLDER_SITE_URL;
}

export function xmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Static page paths from the generated TanStack route tree (FileRoutesByFullPath keys).
 * Dynamic routes ("$param"), aliases and excluded paths are dropped.
 */
export function staticPathsFromRouteTree(routeTreeText, { aliases = {}, exclude = [] } = {}) {
  const block = /export interface FileRoutesByFullPath \{([^}]*)\}/.exec(routeTreeText);
  if (!block) throw new Error("FileRoutesByFullPath not found in routeTree.gen.ts");
  const skip = new Set([...Object.keys(aliases), ...exclude]);
  const paths = [...block[1].matchAll(/'([^']+)':/g)]
    .map((m) => m[1].replace(/_(?=\/|$)/g, ""))
    .filter((p) => !p.includes("$") && !skip.has(p));
  return [...new Set(paths)].sort((a, b) => a.localeCompare(b));
}

function lastmod(value) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ""));
  return m ? m[1] : null;
}

/** docs: [{ id, updatedAt? }] -> /archive/<id> pages. */
export function buildSitemap({ siteUrl, paths, docs = [] }) {
  const base = normalizeSiteUrl(siteUrl);
  const urls = [
    ...paths.map((p) => ({ loc: p === "/" ? `${base}/` : `${base}${p}` })),
    ...docs.map((d) => ({
      loc: `${base}/archive/${encodeURIComponent(d.id)}`,
      lastmod: lastmod(d.updatedAt),
    })),
  ];
  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${xmlEscape(u.loc)}</loc>${
          u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""
        }\n  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function buildRobots(siteUrl) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${normalizeSiteUrl(siteUrl)}/sitemap.xml\n`;
}
