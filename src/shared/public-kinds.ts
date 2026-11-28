/** The kinds of public content the pages load (see src/server/public-data.ts). */
export const PUBLIC_KINDS = ["team", "achievements", "placements", "alumni", "settings"] as const;
export type PublicKind = (typeof PUBLIC_KINDS)[number];

export function isPublicKind(v: unknown): v is PublicKind {
  return typeof v === "string" && (PUBLIC_KINDS as readonly string[]).includes(v);
}
