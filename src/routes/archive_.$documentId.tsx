import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { EmptyState } from "@/components/EmptyState";
import { DocumentPreviewViewer } from "@/components/archive/DocumentPreviewViewer";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_STYLES,
  DRIVE_QUOTA_NOTE,
  formatExamSession,
  formatSemester,
  getDownloadUrl,
  getDriveViewUrl,
  getReportUrl,
} from "@/lib/archive";
import { getDocumentById } from "@/data/archive";
import type { ArchiveDocument } from "@/types";
import {
  ArrowLeft,
  FileText,
  Download,
  Calendar,
  BookOpen,
  Building2,
  Flag,
  Share2,
  ExternalLink,
  Info,
} from "lucide-react";
import { toast } from "sonner";

/** e.g. "Thermal Engineering, Nov 2021, 2019 scheme | CUSAT ME S5 question paper | MESAC" */
function pageTitle(doc: ArchiveDocument): string {
  const session = [doc.examMonth.slice(0, 3), doc.examYear || ""].filter(Boolean).join(" ");
  const head = [doc.subject, session || doc.batch, doc.scheme].filter(Boolean).join(", ");
  const where =
    typeof doc.semester === "number" ? `CUSAT ME S${doc.semester}` : `CUSAT ME ${doc.semester}`;
  const kind = DOCUMENT_TYPE_LABELS[doc.type]?.toLowerCase() ?? "document";
  return `${head} | ${where} ${kind} | MESAC`;
}

function pageDescription(doc: ArchiveDocument): string {
  const session = formatExamSession(doc);
  const kind = DOCUMENT_TYPE_LABELS[doc.type]?.toLowerCase() ?? "document";
  return (
    `${doc.subject} ${kind}${session ? ` (${session})` : ""} for CUSAT B.Tech Mechanical ` +
    `Engineering ${formatSemester(doc.semester)}${doc.scheme ? `, ${doc.scheme}` : ""}. ` +
    "Preview or download the PDF free from the MESAC academic archive."
  );
}

export const Route = createFileRoute("/archive_/$documentId")({
  head: ({ params }) => {
    const doc = getDocumentById(params.documentId);
    const title = doc ? pageTitle(doc) : "Document not found | MESAC Academic Archive";
    const description = doc
      ? pageDescription(doc)
      : "CUSAT Mechanical Engineering question papers and academic documents from MESAC.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: DocumentDetailPage,
});

function DocumentDetailPage() {
  const { documentId } = Route.useParams();
  const router = useRouter();
  const documentItem = getDocumentById(documentId);

  if (!documentItem) {
    return (
      <Layout>
        <div className="py-32 px-4 sm:px-6 mx-auto max-w-4xl">
          <EmptyState
            title="Document Not Found"
            description={`No document with the id "${documentId}" is in the archive. It may have been renamed or removed in Drive.`}
            actionText="Return to Academic Archive"
            onAction={() => {
              router.navigate({ to: "/archive" });
            }}
          />
        </div>
      </Layout>
    );
  }

  const typeStyle = DOCUMENT_TYPE_STYLES[documentItem.type] || DOCUMENT_TYPE_STYLES.question_paper;
  const typeLabel = DOCUMENT_TYPE_LABELS[documentItem.type] || documentItem.type.replace("_", " ");
  const session = formatExamSession(documentItem);
  const reportUrl = getReportUrl(documentItem);

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const specs: Array<[string, string | undefined]> = [
    ["Semester", formatSemester(documentItem.semester)],
    ["Subject", documentItem.subject],
    ["Subject Code", documentItem.subjectCode || undefined],
    ["Scheme", documentItem.scheme || undefined],
    ["Batch", documentItem.batch],
    ["Examination", session || undefined],
    ["File Size", documentItem.preview?.fileSize || undefined],
    ["Department", `${documentItem.department} · ${documentItem.program}`],
  ];

  return (
    <Layout>
      <div className="pt-28 sm:pt-32 pb-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          {/* TOP NAVIGATION & ACTIONS */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <Link
              to="/archive"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition-colors min-h-[40px]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Archive</span>
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition-colors min-h-[40px] cursor-pointer"
                title="Copy link to this document"
              >
                <Share2 className="h-3.5 w-3.5 text-gold" />
                <span className="hidden sm:inline">Share</span>
              </button>

              <a
                href={reportUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/80 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition-colors min-h-[40px]"
                title="Report a problem with this document"
              >
                <Flag className="h-3.5 w-3.5 text-gold" />
                <span>Report Problem</span>
              </a>
            </div>
          </div>

          {/* DOCUMENT HEADER BANNER */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm mb-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-bold uppercase tracking-wider ${typeStyle.badge}`}
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{typeLabel}</span>
              </span>

              <span className="rounded-full bg-secondary px-3 py-0.5 text-xs font-bold text-foreground">
                {documentItem.program} · {formatSemester(documentItem.semester)}
              </span>

              {documentItem.scheme && (
                <span className="rounded-full bg-secondary/60 border border-border/60 px-3 py-0.5 text-xs text-muted-foreground">
                  {documentItem.scheme}
                </span>
              )}
            </div>

            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground leading-tight tracking-tight break-words">
              {documentItem.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-gold shrink-0" aria-hidden="true" />
                <span className="font-semibold text-foreground">{documentItem.subject}</span>
                {documentItem.subjectCode && (
                  <span className="font-mono text-xs text-muted-foreground">
                    ({documentItem.subjectCode})
                  </span>
                )}
              </div>

              {session && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gold shrink-0" aria-hidden="true" />
                  <span>Exam session: {session}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gold shrink-0" aria-hidden="true" />
                <span>{documentItem.department}</span>
              </div>
            </div>
          </div>

          {/* MAIN GRID: PREVIEW VIEWER & METADATA DETAILS */}
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            <div className="lg:col-span-8 min-w-0">
              <DocumentPreviewViewer document={documentItem} />
            </div>

            <div className="lg:col-span-4 space-y-6">
              {/* ACTIONS */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm">
                <h3 className="font-display text-base font-bold text-foreground mb-4">
                  Document Actions
                </h3>

                <div className="space-y-3">
                  <a
                    href={getDownloadUrl(documentItem)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl gradient-gold text-primary font-bold px-5 py-3 text-sm shadow-md hover:brightness-105 active:scale-95 transition-all min-h-[44px]"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download PDF</span>
                  </a>

                  <a
                    href={getDriveViewUrl(documentItem)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors min-h-[42px]"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-gold" />
                    <span>Open in Drive</span>
                  </a>

                  <a
                    href={reportUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/80 px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors min-h-[42px]"
                  >
                    <Flag className="h-3.5 w-3.5 text-gold" />
                    <span>Report Missing/Incorrect File</span>
                  </a>
                </div>

                <p className="mt-4 pt-4 border-t border-border/80 flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
                  <Info className="h-3.5 w-3.5 text-gold shrink-0 mt-px" aria-hidden="true" />
                  <span>{DRIVE_QUOTA_NOTE}</span>
                </p>
              </div>

              {/* DETAILS */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm">
                <h3 className="font-display text-base font-bold text-foreground mb-4">Details</h3>
                <dl className="space-y-3 text-xs">
                  {specs
                    .filter(([, v]) => Boolean(v))
                    .map(([label, value], i, arr) => (
                      <div
                        key={label}
                        className={`flex justify-between gap-4 py-1 ${i < arr.length - 1 ? "border-b border-border/60" : ""}`}
                      >
                        <dt className="text-muted-foreground shrink-0">{label}</dt>
                        <dd className="font-semibold text-foreground text-right break-words min-w-0">
                          {value}
                        </dd>
                      </div>
                    ))}
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
