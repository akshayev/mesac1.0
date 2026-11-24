import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ArchiveDocument } from "@/types";
import { FileText, Download, ExternalLink, Maximize2, Flag, Eye, X, Info } from "lucide-react";
import {
  DRIVE_QUOTA_NOTE,
  getDownloadUrl,
  getDriveViewUrl,
  getPreviewUrl,
  getReportUrl,
} from "@/lib/archive";

export interface DocumentPreviewViewerProps {
  document: ArchiveDocument;
  className?: string;
}

/**
 * Google Drive viewer, mounted only after the user taps "Load preview"
 * (saves data, and Android Chrome can't render PDFs inline anyway).
 * "Expand" opens a full-screen overlay; Esc closes it.
 */
export function DocumentPreviewViewer({ document, className = "" }: DocumentPreviewViewerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const previewUrl = getPreviewUrl(document);
  const downloadUrl = getDownloadUrl(document);
  const driveUrl = getDriveViewUrl(document);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    const prevOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isFullscreen]);

  const iframe = (
    <iframe
      src={previewUrl}
      title={`Preview of ${document.title}`}
      className="h-full w-full border-0 bg-white"
      allow="autoplay"
    />
  );

  return (
    <div
      className={`rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm flex flex-col ${className}`}
    >
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-card/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 text-gold shrink-0">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-foreground line-clamp-1">
              Document Preview
            </span>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {document.preview?.fileSize && <span>{document.preview.fileSize}</span>}
              {document.scheme && (
                <>
                  {document.preview?.fileSize && <span>•</span>}
                  <span>{document.scheme}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLoaded && (
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/80 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer min-h-[36px]"
              title="Expand preview (Esc to close)"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Expand</span>
            </button>
          )}
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl gradient-gold text-primary font-bold px-3.5 py-1.5 text-xs shadow-sm hover:brightness-105 active:scale-95 transition-all min-h-[36px]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </a>
          <a
            href={getReportUrl(document)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-xl border border-border bg-secondary/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[36px]"
            title="Report a problem with this file"
          >
            <Flag className="h-3 w-3" />
            <span className="hidden md:inline">Report</span>
          </a>
        </div>
      </div>

      {/* VIEWER CANVAS */}
      <div className="relative w-full bg-neutral-950/90 h-[420px] sm:h-[550px]">
        {isLoaded ? (
          // Only one iframe at a time, so expanding doesn't load the file twice.
          !isFullscreen && iframe
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-white/80">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-gold mb-4 border border-white/10">
              <FileText className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-white">
              Preview this paper
            </h2>
            <p className="mt-2 max-w-sm text-xs sm:text-sm text-white/70 leading-relaxed">
              Opens Google Drive&apos;s viewer here. On some phones it works better to open the file
              in Drive.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsLoaded(true)}
                className="inline-flex items-center gap-2 rounded-xl gradient-gold text-primary font-bold px-4 py-2 text-xs shadow-sm hover:brightness-105 active:scale-95 transition-all min-h-[44px] cursor-pointer"
              >
                <Eye className="h-4 w-4" />
                <span>Load preview</span>
              </button>
              <a
                href={driveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 text-white px-4 py-2 text-xs font-semibold hover:bg-white/20 transition-colors min-h-[44px]"
              >
                <ExternalLink className="h-3.5 w-3.5 text-gold" />
                <span>Open in Drive</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/80 bg-card px-4 py-2.5 text-[11px] text-muted-foreground">
        <div className="flex items-start gap-2">
          <Info className="h-3.5 w-3.5 text-gold shrink-0 mt-px" />
          <span>{DRIVE_QUOTA_NOTE}</span>
        </div>
        <a
          href={driveUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[24px] items-center gap-1 text-gold hover:underline font-medium ml-auto"
        >
          <span>Open in Drive</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* FULL-SCREEN OVERLAY (portalled: <main> is its own stacking context below the navbar) */}
      {isFullscreen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Preview of ${document.title}`}
            className="fixed inset-0 z-[200] flex flex-col bg-black"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-2 text-white">
              <span className="text-xs sm:text-sm font-semibold line-clamp-1">
                {document.title}
              </span>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                aria-label="Close preview (Esc)"
                autoFocus
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 hover:bg-white/20 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0">{iframe}</div>
          </div>,
          window.document.body,
        )}
    </div>
  );
}
