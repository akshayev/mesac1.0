/** Shapes of the Google-Sheet-driven content (src/data/generated/*.json, built by scripts/sheet-sync.mjs). */

export interface TeamPerson {
  name: string;
  role: string;
  group: string;
  photo: string; // "" -> show initials
  linkedin: string;
  email: string;
  order: number | null;
}

export interface AchievementEntry {
  title: string;
  date: string | null; // YYYY-MM-DD
  category: string;
  description: string;
  image: string;
  link: string;
  order: number | null;
}

export interface PlacementEntry {
  name: string;
  company: string;
  role: string;
  batch: string;
  photo: string;
  linkedin: string;
  order: number | null;
}

/** Raw key/value pairs from the settings tab (only known keys, non-empty). */
export type SettingsValues = Partial<Record<string, string>>;
