/**
 * The committed Google Sheet snapshots (src/data/generated/*.json, written by scripts/sheet-sync.mjs).
 * Server-only: public pages get them through getPublicContent, so the snapshots (and their validation
 * notes) are not bundled into the browser code.
 */
import team from "../data/generated/team.json" with { type: "json" };
import achievements from "../data/generated/achievements.json" with { type: "json" };
import placements from "../data/generated/placements.json" with { type: "json" };
import alumni from "../data/generated/alumni.json" with { type: "json" };
import settings from "../data/generated/settings.json" with { type: "json" };
import type {
  AchievementEntry,
  AlumniEntry,
  PlacementEntry,
  SettingsValues,
  TeamPerson,
} from "../types/site.ts";

export const SNAPSHOTS = {
  team: team.items as TeamPerson[],
  achievements: achievements.items as AchievementEntry[],
  placements: placements.items as PlacementEntry[],
  alumni: alumni.items as AlumniEntry[],
  settings: settings.items as SettingsValues,
};
