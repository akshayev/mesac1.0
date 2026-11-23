import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Search, FileText, ExternalLink, Eye, Info, FolderOpen } from "lucide-react";
import { getArchiveDocuments } from "@/data/archive";
import {
  DOCUMENT_TYPE_LABELS,
  DRIVE_ROOT_URL,
  formatExamSession,
  formatSemester,
  getDriveViewUrl,
} from "@/lib/archive";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/archive")({
  head: () => ({
    meta: [
      { title: "Academic Archive — MESAC Admin" },
      {
        name: "description",
        content: "Read-only view of the archive generated from the MESAC academic Google Drive.",
      },
    ],
  }),
  component: AdminArchivePage,
});

/**
 * Read-only list of the generated archive. The archive is managed in Google Drive:
 * add/rename/move files there, then rebuild (npm run data:archive / npm run build).
 */
export function AdminArchivePage() {
  const documents = getArchiveDocuments();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) =>
      [d.title, d.subject, d.sourcePath, d.driveFileId, d.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [documents, searchQuery]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title="Academic Archive"
          description={`${documents.length} documents generated from the MESAC academic Google Drive.`}
          badge="Read-only"
        >
          <a
            href={DRIVE_ROOT_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#7c1d28] hover:bg-[#63141f] text-white text-xs font-bold h-9 px-4 shadow-xs"
          >
            <FolderOpen className="h-4 w-4" />
            <span>Open Drive folder</span>
          </a>
        </AdminPageHeader>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-neutral-700 dark:text-neutral-300 flex gap-3">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-neutral-900 dark:text-neutral-100">
              Managed in Google Drive
            </p>
            <p>
              To add or fix a paper, upload or rename it in the Drive folder using the{" "}
              <code>S1-8/S5/PYQ/&lt;Subject&gt;/&lt;YYYY&gt; Scheme/</code> layout, then rebuild the
              site. Per-file fixes and hiding go in <code>src/data/archive-overrides.json</code>.
              The last crawl&apos;s problems (unparsed names, unmatched subjects) are listed in{" "}
              <code>data/drive-report.md</code>.
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder="Search title, subject, Drive path or id..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl text-xs"
            aria-label="Search archive"
          />
        </div>

        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-800/50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  <th className="p-3 pl-4">Document</th>
                  <th className="p-3">Semester</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Scheme / Batch</th>
                  <th className="p-3">Exam</th>
                  <th className="p-3">Size</th>
                  <th className="p-3 text-right pr-4">Links</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-neutral-500">
                      <FileText className="h-8 w-8 mx-auto text-neutral-400 mb-2" />
                      <p className="font-semibold text-sm">No documents match</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((doc) => (
                    <tr
                      key={doc.id}
                      className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 transition"
                    >
                      <td className="p-3 pl-4 min-w-[240px]">
                        <div className="font-bold text-neutral-900 dark:text-neutral-100">
                          {doc.title}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5 break-all">
                          {doc.sourcePath}
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">{formatSemester(doc.semester, true)}</td>
                      <td className="p-3 whitespace-nowrap">{DOCUMENT_TYPE_LABELS[doc.type]}</td>
                      <td className="p-3 whitespace-nowrap">{doc.batch || doc.scheme || "—"}</td>
                      <td className="p-3 whitespace-nowrap">{formatExamSession(doc) || "—"}</td>
                      <td className="p-3 whitespace-nowrap">{doc.preview?.fileSize || "—"}</td>
                      <td className="p-3 pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to="/archive/$documentId"
                            params={{ documentId: doc.id }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            title="View public page"
                            aria-label={`View public page for ${doc.title}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <a
                            href={getDriveViewUrl(doc)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            title="Open in Drive"
                            aria-label={`Open ${doc.title} in Drive`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
