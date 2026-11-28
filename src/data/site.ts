/**
 * Site content edited in the Google Sheet or, when it is switched on, in the admin dashboard (D1).
 * Pages load it in their route loaders (loadTeam(), ...) and the settings come from the root route
 * (useSettings()). Where the data comes from is decided on the server: see src/server/public-data.ts.
 */
import { useMatch } from "@tanstack/react-router";
import { useMemo } from "react";
import { fetchPublicContent } from "./content";
import type {
  AchievementEntry,
  AlumniEntry,
  PlacementEntry,
  SettingsValues,
  TeamPerson,
} from "@/types";

/** Used when the settings have no contact_email. */
export const FALLBACK_CONTACT_EMAIL = "mesacusatacademy@gmail.com";

export const loadTeam = () => fetchPublicContent({ data: "team" }) as Promise<TeamPerson[]>;
export const loadAchievements = () =>
  fetchPublicContent({ data: "achievements" }) as Promise<AchievementEntry[]>;
export const loadPlacements = () =>
  fetchPublicContent({ data: "placements" }) as Promise<PlacementEntry[]>;
export const loadAlumni = () => fetchPublicContent({ data: "alumni" }) as Promise<AlumniEntry[]>;
export const loadSettings = () =>
  fetchPublicContent({ data: "settings" }) as Promise<SettingsValues>;

export interface TeamGroup {
  name: string;
  people: TeamPerson[];
}

/** People grouped by the `group` column; groups ordered by their lowest `order`, then name. */
export function groupTeam(team: TeamPerson[]): TeamGroup[] {
  const map = new Map<string, TeamPerson[]>();
  for (const p of team) {
    const list = map.get(p.group) ?? [];
    list.push(p);
    map.set(p.group, list);
  }
  const rank = (people: TeamPerson[]) =>
    Math.min(...people.map((p) => p.order ?? Number.POSITIVE_INFINITY));
  return [...map.entries()]
    .map(([name, people]) => ({ name, people }))
    .sort((a, b) => rank(a.people) - rank(b.people) || a.name.localeCompare(b.name));
}

export interface HomeStat {
  label: string;
  value: string;
}

export interface SiteConfig {
  heroTitle?: string;
  heroSubtitle?: string;
  /** Only stats that have a value. */
  stats: HomeStat[];
  contactEmail: string;
  /** Never hardcoded: only present when settings.contact_phone is set. */
  contactPhone?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  reportFormUrl?: string;
  reportFormFileEntry?: string;
  placementBrochureUrl?: string;
  announcementText?: string;
  announcementLink?: string;
  footerText?: string;
}

export function toSiteConfig(s: SettingsValues): SiteConfig {
  const stat = (key: string, label: string): HomeStat[] =>
    s[key] ? [{ label: s[`${key}_label`] || label, value: s[key] as string }] : [];
  return {
    heroTitle: s.hero_title,
    heroSubtitle: s.hero_subtitle,
    stats: [
      ...stat("stat_members", "Members"),
      ...stat("stat_papers", "Question papers"),
      ...stat("stat_placements", "Placements"),
    ],
    contactEmail: s.contact_email || FALLBACK_CONTACT_EMAIL,
    contactPhone: s.contact_phone,
    instagramUrl: s.instagram_url,
    linkedinUrl: s.linkedin_url,
    reportFormUrl: s.report_form_url,
    reportFormFileEntry: s.report_form_file_entry,
    placementBrochureUrl: s.placement_brochure_url,
    announcementText: s.announcement_text,
    announcementLink: s.announcement_link,
    footerText: s.footer_text,
  };
}

/** The settings loaded by the root route (empty while an error page renders without them). */
export function useSettings(): SiteConfig {
  const raw = useMatch({ from: "__root__", shouldThrow: false })?.loaderData as
    | SettingsValues
    | undefined;
  return useMemo(() => toSiteConfig(raw ?? {}), [raw]);
}
