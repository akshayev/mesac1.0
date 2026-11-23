import seo from "@/data/seo.json";

/** Shown until SITE_URL is set; scripts/check-deploy.mjs refuses to deploy with it. */
export const PLACEHOLDER_SITE_URL = "https://mesac.example";

function normalizeSiteUrl(raw: unknown): string {
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

/** Public address of the site, without a trailing slash. Set the SITE_URL env var at build time. */
export const SITE_URL = normalizeSiteUrl(import.meta.env.SITE_URL);

export const SITE_NAME = "MESAC CUSAT";
export const DEFAULT_OG_IMAGE = "/og-image.jpg";

const aliases = seo.aliases as Record<string, string>;

/** Pages that exist under two URLs point their canonical link at the one the nav uses. */
export function canonicalPath(path: string): string {
  return aliases[path] ?? path;
}

export function absoluteUrl(path: string): string {
  return path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}

export interface PageHeadInput {
  title: string;
  description: string;
  /** Path of this page, e.g. "/archive" or "/archive/abc". */
  path: string;
}

/** Title, description, canonical URL, Open Graph and Twitter tags for one page. */
export function pageHead({ title, description, path }: PageHeadInput) {
  const url = absoluteUrl(canonicalPath(path));
  const image = absoluteUrl(DEFAULT_OG_IMAGE);
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:image", content: image },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
