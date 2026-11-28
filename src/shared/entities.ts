/**
 * The content the admin dashboard edits, described once and used by both the server (validation, SQL
 * mapping) and the dashboard (forms, lists). Field names are the ones the public pages already use.
 * No Node, browser or Vite APIs here: the Node tests import this file directly.
 */

export type FieldKind =
  | "text" // one line, max `max` characters
  | "longtext" // several lines
  | "url" // http(s) link
  | "linkedin" // https link on linkedin.com
  | "email" // one email address, safe inside mailto:
  | "phone" // digits, spaces, dashes, leading +; 10-digit Indian numbers become +91...
  | "photo" // uploaded photo (/media/...), https image, Drive link or people/x.webp
  | "date" // YYYY-MM-DD (also DD/MM/YYYY, "14 Mar 2026")
  | "list"; // semicolon list

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  max?: number;
  help?: string;
  placeholder?: string;
}

export type EntityName = "team" | "achievements" | "placements" | "alumni";

export interface EntityDef {
  name: EntityName;
  /** Section title in the dashboard. */
  title: string;
  /** One item, for buttons: "Add team member". */
  singular: string;
  /** The field shown as the row's main text. */
  labelField: string;
  /** Secondary text in the list. */
  detailFields: string[];
  fields: FieldDef[];
  /**
   * False for alumni: their names and contacts never go into the activity log, even as a label.
   * The other entities are already public, so their name/title is a useful, harmless label.
   */
  auditLabel: boolean;
}

export const ENTITIES: Record<EntityName, EntityDef> = {
  team: {
    name: "team",
    title: "Team",
    singular: "team member",
    labelField: "name",
    detailFields: ["role", "group"],
    auditLabel: true,
    fields: [
      { name: "name", label: "Name", kind: "text", required: true, max: 120 },
      {
        name: "role",
        label: "Role",
        kind: "text",
        max: 120,
        placeholder: "e.g. General Secretary",
      },
      {
        name: "group",
        label: "Group",
        kind: "text",
        max: 80,
        help: "Heading on the Team page, e.g. Core Committee. Empty means Team.",
      },
      { name: "photo", label: "Photo", kind: "photo" },
      { name: "linkedin", label: "LinkedIn", kind: "url", help: "Full https:// address." },
      {
        name: "email",
        label: "Public email",
        kind: "email",
        help: "Shown on the site. Leave empty unless the person agrees.",
      },
    ],
  },
  achievements: {
    name: "achievements",
    title: "Achievements",
    singular: "achievement",
    labelField: "title",
    detailFields: ["date", "category"],
    auditLabel: true,
    fields: [
      { name: "title", label: "Title", kind: "text", required: true, max: 200 },
      { name: "date", label: "Date", kind: "date", help: "YYYY-MM-DD, or leave empty." },
      { name: "category", label: "Category", kind: "text", max: 80 },
      { name: "description", label: "Description", kind: "longtext", max: 4000 },
      { name: "image", label: "Image", kind: "photo" },
      { name: "link", label: "Link", kind: "url", help: "Shows a “Read more” button." },
    ],
  },
  placements: {
    name: "placements",
    title: "Placements",
    singular: "placement",
    labelField: "name",
    detailFields: ["company", "batch"],
    auditLabel: true,
    fields: [
      { name: "name", label: "Student name", kind: "text", required: true, max: 120 },
      { name: "company", label: "Company", kind: "text", required: true, max: 120 },
      { name: "role", label: "Role", kind: "text", max: 120 },
      { name: "batch", label: "Batch", kind: "text", max: 20, placeholder: "e.g. 2025" },
      { name: "photo", label: "Photo", kind: "photo" },
      { name: "linkedin", label: "LinkedIn", kind: "url" },
    ],
  },
  alumni: {
    name: "alumni",
    title: "Alumni",
    singular: "alumnus",
    labelField: "name",
    detailFields: ["batch", "company"],
    auditLabel: false,
    fields: [
      { name: "name", label: "Name", kind: "text", required: true, max: 120 },
      { name: "batch", label: "Batch", kind: "text", max: 20, placeholder: "e.g. 2018" },
      { name: "department", label: "Department", kind: "text", max: 120 },
      { name: "currentRole", label: "Current role", kind: "text", max: 120 },
      { name: "company", label: "Company", kind: "text", max: 120 },
      { name: "location", label: "Location", kind: "text", max: 120 },
      { name: "photo", label: "Photo", kind: "photo" },
      {
        name: "linkedin",
        label: "LinkedIn",
        kind: "linkedin",
        help: "https://www.linkedin.com/in/... only.",
      },
      { name: "email", label: "Public email", kind: "email" },
      {
        name: "phone",
        label: "Public phone",
        kind: "phone",
        help: "Only with clear consent to show the number. 10-digit numbers become +91...",
      },
      {
        name: "helpWith",
        label: "Can help with",
        kind: "list",
        max: 300,
        placeholder: "Career advice; Referrals; Higher studies",
        help: "Separate topics with semicolons.",
      },
    ],
  },
};

export const ENTITY_NAMES = Object.keys(ENTITIES) as EntityName[];

export function isEntityName(v: unknown): v is EntityName {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(ENTITIES, v);
}

/** Labels for the settings keys (the keys themselves come from scripts/lib/validate.mjs SETTING_KEYS). */
export const SETTING_LABELS: Record<string, { label: string; help?: string; long?: boolean }> = {
  hero_title: { label: "Home: headline" },
  hero_subtitle: { label: "Home: sentence under the headline", long: true },
  stat_members: { label: "Home number 1 (members)" },
  stat_members_label: { label: "Home number 1 label", help: "Default: Members" },
  stat_papers: { label: "Home number 2 (papers)" },
  stat_papers_label: { label: "Home number 2 label", help: "Default: Question papers" },
  stat_placements: { label: "Home number 3 (placements)" },
  stat_placements_label: { label: "Home number 3 label", help: "Default: Placements" },
  contact_email: {
    label: "Contact email",
    help: "Contact page, report-a-problem and removal links",
  },
  contact_phone: { label: "Contact phone", help: "Shown on the Contact page" },
  instagram_url: { label: "Instagram link" },
  linkedin_url: { label: "LinkedIn page link" },
  report_form_url: { label: "Report-a-problem Google Form link" },
  report_form_file_entry: {
    label: "Form field for the file name",
    help: "Looks like entry.123456789",
  },
  placement_brochure_url: { label: "Placement brochure link" },
  announcement_text: { label: "Announcement banner text", long: true },
  announcement_link: { label: "Announcement link", help: "https://... or a page like /archive" },
  footer_text: { label: "Extra footer line" },
};
