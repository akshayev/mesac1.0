import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { EmptyState } from "@/components/EmptyState";
import { StickyFilterBar } from "@/components/StickyFilterBar";
import { ArchiveDocumentCard } from "@/components/archive/ArchiveDocumentCard";
import { DOCUMENT_TYPE_LABELS } from "@/lib/archive";
import { getArchiveDocuments, getSubjectsWithCounts } from "@/data/archive";
import type { ArchiveDocument, ArchiveDocumentType } from "@/types";
import {
  Search,
  SlidersHorizontal,
  X,
  RotateCcw,
  ChevronRight,
  GraduationCap,
  FolderOpen,
} from "lucide-react";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/archive")({
  head: () =>
    pageHead({
      title: "Question Paper Archive — CUSAT Mechanical Engineering | MESAC",
      description:
        "Previous year question papers and internal exams for CUSAT B.Tech Mechanical Engineering by semester, subject, scheme and year. Free preview and download.",
      path: "/archive",
    }),
  component: ArchivePage,
});

const ALL = "All";
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const TYPE_ORDER: ArchiveDocumentType[] = [
  "question_paper",
  "internal_paper",
  "syllabus",
  "notes",
  "lab_manual",
  "gate_paper",
];

const semKey = (d: ArchiveDocument) => String(d.semester);
const semKeyLabel = (k: string) => (/^\d+$/.test(k) ? `Semester ${k}` : k);
const semKeyRank = (k: string) => (/^\d+$/.test(k) ? Number(k) : 99);

const selectClass =
  "w-full rounded-xl border border-input bg-card px-2.5 py-2 text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-gold min-h-[38px] cursor-pointer";
const inlineSelectClass =
  "rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-gold cursor-pointer";

function ArchivePage() {
  const documents = getArchiveDocuments();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSemester, setSelectedSemester] = useState(ALL);
  const [selectedSubject, setSelectedSubject] = useState(ALL);
  const [selectedType, setSelectedType] = useState(ALL);
  const [selectedScheme, setSelectedScheme] = useState(ALL);
  const [selectedYear, setSelectedYear] = useState(ALL);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Browse view starts on the first semester that has files.
  const firstWithFiles = SEMESTERS.find((s) => documents.some((d) => d.semester === s)) ?? 1;
  const [browseSemester, setBrowseSemester] = useState<number>(firstWithFiles);
  const gateCount = documents.filter((d) => d.semester === "GATE").length;
  const browseSubjects = useMemo(() => getSubjectsWithCounts(browseSemester), [browseSemester]);

  // Filter options come from the real data.
  const semesters = useMemo(
    () =>
      [...new Set(documents.map(semKey))]
        .filter(Boolean)
        .sort((a, b) => semKeyRank(a) - semKeyRank(b)),
    [documents],
  );
  const subjects = useMemo(() => {
    const set = new Set<string>();
    for (const d of documents) {
      if (selectedSemester === ALL || semKey(d) === selectedSemester) set.add(d.subject);
    }
    return [...set].sort();
  }, [documents, selectedSemester]);
  const types = useMemo(
    () => TYPE_ORDER.filter((t) => documents.some((d) => d.type === t)),
    [documents],
  );
  const schemes = useMemo(
    () => [...new Set(documents.map((d) => d.scheme).filter(Boolean))].sort(),
    [documents],
  );
  const years = useMemo(
    () =>
      [...new Set(documents.map((d) => d.examYear).filter((y) => y > 0))]
        .sort((a, b) => b - a)
        .map(String),
    [documents],
  );

  const filteredDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return documents.filter((doc) => {
      if (selectedSemester !== ALL && semKey(doc) !== selectedSemester) return false;
      if (selectedSubject !== ALL && doc.subject !== selectedSubject) return false;
      if (selectedType !== ALL && doc.type !== selectedType) return false;
      if (selectedScheme !== ALL && doc.scheme !== selectedScheme) return false;
      if (selectedYear !== ALL && String(doc.examYear) !== selectedYear) return false;
      if (q) {
        const haystack = [doc.title, doc.subject, doc.subjectCode, doc.batch, ...doc.tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    documents,
    searchQuery,
    selectedSemester,
    selectedSubject,
    selectedType,
    selectedScheme,
    selectedYear,
  ]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    [selectedSemester, selectedSubject, selectedType, selectedScheme, selectedYear].some(
      (v) => v !== ALL,
    );

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedSemester(ALL);
    setSelectedSubject(ALL);
    setSelectedType(ALL);
    setSelectedScheme(ALL);
    setSelectedYear(ALL);
  };

  const scrollToCatalog = () => {
    if (typeof window === "undefined") return;
    // Lenis (SmoothScroll) cancels native smooth scrolling, so jump instantly.
    // scroll-margin-top on .sticky-content-container accounts for the navbar + sticky filters.
    const el = window.document.getElementById("catalog");
    if (!el) return;
    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const top = el.getBoundingClientRect().top + window.scrollY - margin;
    window.scrollTo({ top, behavior: "instant" });
  };

  const openSubject = (semester: string, subject: string) => {
    handleResetFilters();
    setSelectedSemester(semester);
    setSelectedSubject(subject);
    scrollToCatalog();
  };

  const changeSemester = (v: string) => {
    setSelectedSemester(v);
    setSelectedSubject(ALL);
  };

  // A filter with a single value is noise; hide it.
  const showSemester = semesters.length > 1;
  const showSubject = subjects.length > 1 || selectedSubject !== ALL;
  const showType = types.length > 1;
  const showScheme = schemes.length > 1;
  const showYear = years.length > 1;

  const activeChips: Array<{ label: string; clear: () => void }> = [
    searchQuery && { label: `Search: "${searchQuery}"`, clear: () => setSearchQuery("") },
    selectedSemester !== ALL && {
      label: semKeyLabel(selectedSemester),
      clear: () => changeSemester(ALL),
    },
    selectedSubject !== ALL && { label: selectedSubject, clear: () => setSelectedSubject(ALL) },
    selectedType !== ALL && {
      label: DOCUMENT_TYPE_LABELS[selectedType as ArchiveDocumentType] ?? selectedType,
      clear: () => setSelectedType(ALL),
    },
    selectedScheme !== ALL && { label: selectedScheme, clear: () => setSelectedScheme(ALL) },
    selectedYear !== ALL && { label: selectedYear, clear: () => setSelectedYear(ALL) },
  ].filter(Boolean) as Array<{ label: string; clear: () => void }>;

  return (
    <Layout>
      {/* 1. HERO */}
      <PageHero
        variant="downloads"
        eyebrow="Academic Repository"
        title={
          <>
            ACADEMIC <span className="italic text-gold">ARCHIVE</span>
          </>
        }
        subtitle="Previous year question papers and internal exam papers for CUSAT B.Tech Mechanical Engineering, collected by MESAC and organised by semester and subject."
      />

      {/* 2. BROWSE STEPPER / HIERARCHY BAR */}
      <section className="border-b border-border bg-card/60 py-3.5 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-medium">
            <div className="flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5 text-gold shrink-0" aria-hidden="true" />
              <span className="font-semibold text-foreground">Mechanical · B.Tech</span>
            </div>
            {showSemester && (
              <>
                <ChevronRight className="h-3 w-3 opacity-50 shrink-0" aria-hidden="true" />
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground/80">Semester:</span>
                  <select
                    aria-label="Filter by semester"
                    value={selectedSemester}
                    onChange={(e) => changeSemester(e.target.value)}
                    className={inlineSelectClass}
                  >
                    <option value={ALL}>All Semesters</option>
                    {semesters.map((s) => (
                      <option key={s} value={s}>
                        {semKeyLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {showSubject && (
              <>
                <ChevronRight className="h-3 w-3 opacity-50 shrink-0" aria-hidden="true" />
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-muted-foreground/80">Subject:</span>
                  <select
                    aria-label="Filter by subject"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className={`${inlineSelectClass} max-w-[180px] sm:max-w-[260px] truncate`}
                  >
                    <option value={ALL}>All Subjects</option>
                    {subjects.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 3. BROWSE BY SEMESTER -> SUBJECT */}
      <section className="py-10 sm:py-14 bg-background border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">
            Browse by semester
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every subject in the B.Tech Mechanical curriculum, including ones we don&apos;t have
            papers for yet.
          </p>

          <div
            role="tablist"
            aria-label="Semester"
            className="mt-5 flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {SEMESTERS.map((s) => {
              const active = browseSemester === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setBrowseSemester(s)}
                  className={
                    "shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-150 cursor-pointer min-h-[40px] " +
                    (active
                      ? "gradient-gold text-primary shadow-sm"
                      : "border border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-secondary")
                  }
                >
                  S{s}
                </button>
              );
            })}
            {gateCount > 0 && (
              <button
                type="button"
                onClick={() => openSubject("GATE", ALL)}
                className="shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold border border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer min-h-[40px]"
              >
                GATE ({gateCount})
              </button>
            )}
          </div>

          {browseSubjects.length === 0 && (
            <p className="mt-5 rounded-2xl border border-dashed border-border/70 bg-card/40 p-5 text-sm text-muted-foreground">
              No subjects listed for S{browseSemester} yet.
            </p>
          )}

          <div className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {browseSubjects.map((s) => {
              const empty = s.count === 0;
              return (
                <button
                  key={s.name}
                  type="button"
                  disabled={empty}
                  onClick={() => openSubject(String(s.semester), s.name)}
                  className={
                    "group flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all min-h-[64px] " +
                    (empty
                      ? "border-dashed border-border/70 bg-card/40 cursor-default"
                      : "border-border/80 bg-card hover:border-gold/50 cursor-pointer card-lift")
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FolderOpen
                      className={`h-5 w-5 shrink-0 ${empty ? "text-muted-foreground/50" : "text-gold"}`}
                      aria-hidden="true"
                    />
                    <span
                      className={`text-sm font-semibold leading-snug ${empty ? "text-muted-foreground" : "text-foreground group-hover:text-gold"}`}
                    >
                      {s.name}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${empty ? "bg-secondary/40 text-muted-foreground" : "bg-gold/15 text-gold"}`}
                  >
                    {empty ? "Not uploaded yet" : `${s.count} ${s.count === 1 ? "file" : "files"}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. SEARCH & FILTER CONTROLS */}
      <StickyFilterBar className="border-b border-border bg-background/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* SEARCH INPUT */}
            <div className="relative flex-1 max-w-md">
              <Search
                aria-hidden="true"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              />
              <input
                type="text"
                aria-label="Search by title, subject or year"
                placeholder="Search subject, year or batch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-input bg-card/60 pl-10 pr-9 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-gold min-h-[42px]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search query"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* QUICK TYPE TABS (DESKTOP) */}
            {showType && (
              <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto">
                {[ALL, ...types].map((t) => {
                  const active = selectedType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedType(t)}
                      className={
                        "rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer min-h-[40px] flex items-center gap-1.5 " +
                        (active
                          ? "gradient-gold text-primary shadow-sm"
                          : "border border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-secondary")
                      }
                    >
                      <span>
                        {t === ALL ? "All Types" : DOCUMENT_TYPE_LABELS[t as ArchiveDocumentType]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* MOBILE FILTER TRIGGER & RESET BUTTON */}
            <div className="flex items-center gap-2 justify-between md:justify-end">
              <button
                type="button"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                aria-expanded={showMobileFilters}
                className="lg:hidden inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition-colors min-h-[40px] cursor-pointer"
              >
                <SlidersHorizontal className="h-4 w-4 text-gold" />
                <span>Filters {hasActiveFilters ? "(Active)" : ""}</span>
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/80 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition-colors min-h-[40px] cursor-pointer"
                  title="Clear all search parameters and filters"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* EXPANDABLE / MOBILE FILTERS ROW */}
          <div
            className={`pt-3 border-t border-border/60 mt-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 ${
              showMobileFilters ? "grid" : "hidden lg:grid"
            }`}
          >
            {showSemester && (
              <div>
                <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                  Semester
                </label>
                <select
                  aria-label="Filter by semester"
                  value={selectedSemester}
                  onChange={(e) => changeSemester(e.target.value)}
                  className={selectClass}
                >
                  <option value={ALL}>All Semesters</option>
                  {semesters.map((s) => (
                    <option key={s} value={s}>
                      {semKeyLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showSubject && (
              <div>
                <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                  Subject
                </label>
                <select
                  aria-label="Filter by subject"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className={`${selectClass} truncate`}
                >
                  <option value={ALL}>All Subjects</option>
                  {subjects.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showType && (
              <div className="lg:hidden">
                <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                  Document Type
                </label>
                <select
                  aria-label="Filter by document type"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className={selectClass}
                >
                  <option value={ALL}>All Types</option>
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {DOCUMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showScheme && (
              <div>
                <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                  Scheme
                </label>
                <select
                  aria-label="Filter by scheme"
                  value={selectedScheme}
                  onChange={(e) => setSelectedScheme(e.target.value)}
                  className={selectClass}
                >
                  <option value={ALL}>All Schemes</option>
                  {schemes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showYear && (
              <div>
                <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                  Exam Year
                </label>
                <select
                  aria-label="Filter by exam year"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className={selectClass}
                >
                  <option value={ALL}>All Years</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </StickyFilterBar>

      {/* 5. RESULTS */}
      <section id="catalog" className="sticky-content-container py-10 sm:py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-8">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">
                Document Catalog
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filteredDocuments.length === 1
                  ? "1 document found"
                  : `${filteredDocuments.length} documents found`}
                {hasActiveFilters ? " matching your filters" : ""}
              </p>
            </div>

            {activeChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {activeChips.map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] text-foreground"
                  >
                    <span>{chip.label}</span>
                    <button
                      type="button"
                      onClick={chip.clear}
                      aria-label={`Remove filter ${chip.label}`}
                      className="hover:text-gold cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {filteredDocuments.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDocuments.map((doc) => (
                <Reveal key={doc.id}>
                  <ArchiveDocumentCard document={doc} />
                </Reveal>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No documents match your search"
              description="Try clearing some filters or picking a different semester."
              actionText="Reset All Filters"
              onAction={handleResetFilters}
            />
          )}

          <p className="mt-10 text-center text-[11px] text-muted-foreground">
            Files are hosted on the MESAC academic Google Drive. B.Tech Mechanical Engineering only.
          </p>
        </div>
      </section>
    </Layout>
  );
}
