/**
 * Academic archive data, generated at build time from Google Drive by
 * scripts/drive-index.mjs (see data/drive-report.md for what was indexed).
 * Edit src/data/archive-overrides.json to fix or hide a file, never the generated JSON.
 */
import type { ArchiveDocument, ArchiveSubject } from "@/types";
import generated from "./generated/archive.json";
import subjectList from "./subjects.json";

const documents = generated as ArchiveDocument[];
const subjects = subjectList as ArchiveSubject[];
const byId = new Map(documents.map((d) => [d.id, d]));

export function getArchiveDocuments(): ArchiveDocument[] {
  return documents;
}

export function getDocumentById(id: string): ArchiveDocument | undefined {
  return byId.get(id);
}

export function getSubjects(): ArchiveSubject[] {
  return subjects;
}

export interface SubjectWithCount {
  semester: number;
  name: string;
  count: number;
  listed: boolean; // false when the subject only exists in Drive, not in subjects.json
}

/** Every subject in subjects.json for a semester (0 files included), plus any extra subjects found in Drive. */
export function getSubjectsWithCounts(semester: number): SubjectWithCount[] {
  const counts = new Map<string, number>();
  for (const d of documents) {
    if (d.semester === semester) counts.set(d.subject, (counts.get(d.subject) ?? 0) + 1);
  }
  const listed = subjects
    .filter((s) => s.semester === semester)
    .map((s) => ({ semester, name: s.name, count: counts.get(s.name) ?? 0, listed: true }));
  const known = new Set(listed.map((s) => s.name));
  const extra = [...counts.entries()]
    .filter(([name]) => !known.has(name))
    .map(([name, count]) => ({ semester, name, count, listed: false }));
  return [...listed, ...extra];
}
