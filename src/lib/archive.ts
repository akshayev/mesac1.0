import type { ArchiveDocument, ArchiveDocumentType } from "@/types";
import { getSettings } from "@/data/site";

export const DOCUMENT_TYPE_LABELS: Record<ArchiveDocumentType, string> = {
  question_paper: "Question Paper",
  internal_paper: "Internal Exam",
  syllabus: "Syllabus",
  notes: "Lecture Notes",
  lab_manual: "Lab Manual",
  gate_paper: "GATE Paper",
};

export const DOCUMENT_TYPE_STYLES: Record<
  ArchiveDocumentType,
  { badge: string; iconColor: string }
> = {
  question_paper: {
    badge: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    iconColor: "text-amber-500",
  },
  internal_paper: {
    badge: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    iconColor: "text-orange-400",
  },
  syllabus: {
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    iconColor: "text-blue-400",
  },
  notes: {
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    iconColor: "text-emerald-400",
  },
  lab_manual: {
    badge: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    iconColor: "text-purple-400",
  },
  gate_paper: {
    badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    iconColor: "text-rose-400",
  },
};

export const DRIVE_ROOT_URL =
  "https://drive.google.com/drive/folders/1O_Q5coUAKKpSu3Egmz5YOu9MzdPxyiR6";
export const DRIVE_QUOTA_NOTE =
  "If Drive says too many downloads, use Open in Drive → Make a copy.";

function withResourceKey(url: string, doc: ArchiveDocument): string {
  if (!doc.resourceKey) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}resourcekey=${encodeURIComponent(doc.resourceKey)}`;
}

/** Drive's embeddable viewer. Load it only after the user asks for it. */
export function getPreviewUrl(doc: ArchiveDocument): string {
  return withResourceKey(`https://drive.google.com/file/d/${doc.driveFileId}/preview`, doc);
}

/** Mirrored copy when the build downloaded it, otherwise Drive's direct-download URL. */
export function getDownloadUrl(doc: ArchiveDocument): string {
  if (doc.localUrl) return doc.localUrl;
  return withResourceKey(`https://drive.google.com/uc?export=download&id=${doc.driveFileId}`, doc);
}

export function getDriveViewUrl(doc: ArchiveDocument): string {
  if (doc.driveViewUrl) return doc.driveViewUrl;
  return withResourceKey(`https://drive.google.com/file/d/${doc.driveFileId}/view`, doc);
}

/** Google Form (VITE_REPORT_FORM_URL) with the doc prefilled, or a prefilled email. */
export function getReportUrl(doc: ArchiveDocument): string {
  const label = `${doc.title} [${doc.id}]`;
  const settings = getSettings();
  const formUrl =
    settings.reportFormUrl || (import.meta.env.VITE_REPORT_FORM_URL as string | undefined);
  const entry =
    settings.reportFormFileEntry ||
    (import.meta.env.VITE_REPORT_FORM_FILE_ENTRY as string | undefined);
  if (formUrl) {
    try {
      const u = new URL(formUrl);
      if (entry) {
        u.searchParams.set("usp", "pp_url");
        u.searchParams.set(entry, label);
      }
      return u.toString();
    } catch {
      // fall through to email
    }
  }
  const subject = `Archive problem: ${doc.title}`;
  const body = [
    "What is wrong with this file? (wrong subject/year, missing pages, broken link, ...)",
    "",
    "",
    "---",
    `Document: ${doc.title}`,
    `ID: ${doc.id}`,
    `Drive file: ${doc.driveFileId}`,
    ...(doc.sourcePath ? [`Drive path: ${doc.sourcePath}`] : []),
  ].join("\n");
  return `mailto:${settings.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function formatSemester(sem: ArchiveDocument["semester"], short = false): string {
  if (typeof sem === "number") return short ? `Sem ${sem}` : `Semester ${sem}`;
  return String(sem ?? "");
}

export function formatExamSession(doc: ArchiveDocument): string {
  return [doc.examMonth, doc.examYear || ""].filter(Boolean).join(" ");
}
