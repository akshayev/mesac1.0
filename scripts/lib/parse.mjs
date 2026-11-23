// Pure helpers that turn a Drive path into archive metadata.
// No I/O here, so everything is covered by scripts/tests/parse.test.mjs.

export const MESAC_OWNER = "mesacusatacademy@gmail.com";

/** Hidden by default (copyright unclear / published books). */
export const HIDDEN_KINDS = new Set(["reference", "gate_material"]);

const SCHEME_RE = /(\d{4})\s*scheme/i;
const BATCH_RE = /(\d{4})\s*-\s*(\d{2})\s*batch/i;
const PAPER_RE = /(\d{4})\s+([A-Za-z]+)\s*\(\s*(\d{4})\s*Ad\.?\s*\)/i;
const ORDINAL_RE = /\b(1st|2nd|3rd|first|second|third)\b/i;

const MONTHS = {
  jan: "January",
  feb: "February",
  mar: "March",
  apr: "April",
  may: "May",
  jun: "June",
  jul: "July",
  aug: "August",
  sep: "September",
  oct: "October",
  nov: "November",
  dec: "December",
};

const ORDINALS = { first: "1st", second: "2nd", third: "3rd" };

/** Trim and collapse runs of whitespace. */
export function clean(s) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowercase, & -> and, strip everything that isn't a letter or digit. */
export function normSubject(s) {
  return clean(s)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

export function stripExt(name) {
  return clean(name).replace(/\.[a-z0-9]{2,4}$/i, "");
}

export function normMonth(m) {
  return MONTHS[String(m).slice(0, 3).toLowerCase()] ?? clean(m);
}

export function parseScheme(s) {
  const m = SCHEME_RE.exec(clean(s));
  return m ? `${m[1]} scheme` : "";
}

export function parseBatch(s) {
  const m = BATCH_RE.exec(clean(s));
  return m ? `${m[1]}-${m[2]} batch` : "";
}

export function parseOrdinal(s) {
  const m = ORDINAL_RE.exec(clean(s));
  if (!m) return "";
  const v = m[1].toLowerCase();
  return ORDINALS[v] ?? v;
}

/**
 * "<Subject> <YYYY> <Month> (<scheme> Ad).pdf" -> { subject, year, month, scheme }
 * Returns null when the name doesn't follow the convention.
 */
export function parsePaperName(name) {
  const base = stripExt(name);
  const m = PAPER_RE.exec(base);
  if (!m) return null;
  return {
    subject: clean(base.slice(0, m.index)),
    year: Number(m[1]),
    month: normMonth(m[2]),
    scheme: `${m[3]} scheme`,
  };
}

/**
 * Classify a Drive path (array of raw segments, last one is the file name).
 * Returns { kind, semester, subjectFolder, scheme, batch, labName, gateYear, hidden }
 * kind is null when the path doesn't fit the known layout.
 */
export function classifyPath(segments) {
  const seg = segments.map(clean);
  const fileName = seg[seg.length - 1];
  const folders = seg.slice(0, -1);
  const out = {
    kind: null,
    semester: null,
    subjectFolder: "",
    scheme: "",
    batch: "",
    labName: "",
    gateYear: null,
    hidden: false,
  };

  const top = (folders[0] ?? "").toLowerCase().replace(/\s/g, "");

  if (top === "s1-8") {
    const sem = /^s\s*(\d)$/i.exec(folders[1] ?? "");
    if (!sem) return out;
    out.semester = Number(sem[1]);
    const section = (folders[2] ?? "").toLowerCase();
    const rest = folders.slice(3);

    switch (section) {
      case "pyq": {
        const isInternal = /internal/i.test(fileName);
        out.kind = isInternal ? "internal_paper" : "question_paper";
        if (rest.length === 0) {
          // Loose file directly under PYQ (e.g. "2025 scheme S3 First internal.pdf").
          out.scheme = parseScheme(fileName);
        } else if (parseScheme(rest[0])) {
          // S8 layout: scheme folders directly under PYQ, no subject level.
          out.scheme = parseScheme(rest[0]);
        } else {
          out.subjectFolder = rest[0];
          out.scheme = parseScheme(rest[1] ?? "");
        }
        if (isInternal && !out.scheme) out.scheme = parseScheme(fileName);
        break;
      }
      case "internals":
      case "notes":
        out.kind = section === "notes" ? "notes" : "internal_paper";
        out.subjectFolder = rest[0] ?? "";
        out.batch = parseBatch(rest[1] ?? "");
        break;
      case "syllabus":
        out.kind = "syllabus";
        out.scheme = parseScheme(rest[0] ?? "");
        break;
      case "lab":
        out.kind = "lab_manual";
        out.labName = rest[0] ?? "";
        break;
      case "data book":
        out.kind = "reference";
        break;
      default:
        return out;
    }
  } else if (top === "gate") {
    const section = (folders[1] ?? "").toLowerCase();
    if (section === "pyq") {
      out.kind = "gate_paper";
      const y = /^(\d{4})$/.exec(folders[2] ?? "") ?? /(\d{4})/.exec(fileName);
      out.gateYear = y ? Number(y[1]) : null;
    } else if (section === "study material") {
      out.kind = "gate_material";
    } else {
      return out;
    }
  } else {
    return out;
  }

  out.hidden = HIDDEN_KINDS.has(out.kind);
  return out;
}

/**
 * Find a subject from subjects.json by name or alias.
 * Prefers the same semester; falls back to any semester.
 * Returns the subject entry or null.
 */
export function matchSubject(raw, semester, subjects) {
  const key = normSubject(raw);
  if (!key) return null;
  const hits = subjects.filter(
    (s) => normSubject(s.name) === key || (s.aliases ?? []).some((a) => normSubject(a) === key),
  );
  return hits.find((s) => s.semester === semester) ?? hits[0] ?? null;
}

export function slugify(s) {
  return clean(s)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SHORT_MONTH = (m) => (m ? m.slice(0, 3).toLowerCase() : "");

/**
 * Turn one Drive file into an ArchiveDocument (without overrides / localUrl).
 * file: { path: string[], id, size, mimeType, modifiedTime, owner, resourceKey }
 * Returns { doc, meta } where meta carries report-only info.
 */
export function buildDocument(file, subjects) {
  const c = classifyPath(file.path);
  const fileName = clean(file.path[file.path.length - 1]);
  const base = stripExt(fileName);
  const meta = {
    kind: c.kind,
    hidden: c.hidden,
    unparsed: false,
    unmatchedSubject: "",
    subjectNeedsConfirm: false,
  };

  // Resolve the subject.
  let subjectName = "";
  let subjectCode = "";
  let paper = null;
  if (c.kind === "question_paper") paper = parsePaperName(fileName);

  const subjectSource = c.subjectFolder || (c.kind === "question_paper" && paper?.subject) || "";
  if (subjectSource) {
    const hit = matchSubject(subjectSource, c.semester, subjects);
    if (hit) {
      subjectName = hit.name;
      subjectCode = hit.code ?? "";
      meta.subjectNeedsConfirm = Boolean(hit.confirm);
    } else {
      subjectName = clean(subjectSource);
      meta.unmatchedSubject = subjectName;
    }
  } else if (c.kind === "lab_manual") {
    subjectName = clean(c.labName) || "Laboratory";
  } else if (c.kind === "syllabus") {
    subjectName = "Syllabus";
  } else if (c.kind === "gate_paper" || c.kind === "gate_material") {
    subjectName = "GATE Mechanical Engineering";
  } else if (c.kind === "reference") {
    subjectName = "Data Book";
  } else {
    subjectName = "General";
  }

  const semLabel = c.semester ? `S${c.semester}` : "";
  let title = base;
  let examYear = 0;
  let examMonth = "";
  let scheme = c.scheme;
  let slugParts = [];

  switch (c.kind) {
    case "question_paper":
      if (paper) {
        examYear = paper.year;
        examMonth = paper.month;
        scheme = scheme || paper.scheme;
        title = `${subjectName} · ${examMonth} ${examYear}`;
        slugParts = [semLabel, subjectName, String(examYear), SHORT_MONTH(examMonth)];
      } else {
        meta.unparsed = true;
        title = subjectName ? `${subjectName} · ${base}` : base;
        slugParts = [semLabel, subjectName || base];
      }
      break;
    case "internal_paper": {
      const ord = parseOrdinal(base);
      const head = subjectSource ? subjectName : semLabel;
      title = [head, ord ? `${ord} internal` : "Internal exam", c.batch || scheme]
        .filter(Boolean)
        .join(" · ");
      if (!subjectSource) subjectName = "Internal exams";
      slugParts = [semLabel, subjectSource ? subjectName : "", "internal", ord, c.batch || scheme];
      break;
    }
    case "notes":
      title = [subjectName, "Notes", c.batch, base].filter(Boolean).join(" · ");
      slugParts = [semLabel, subjectName, "notes", c.batch];
      break;
    case "syllabus":
      title = [semLabel, "Syllabus", scheme].filter(Boolean).join(" · ");
      slugParts = [semLabel, "syllabus", scheme];
      break;
    case "lab_manual":
      title = `${subjectName} · ${base}`;
      slugParts = [semLabel, subjectName, "lab"];
      break;
    case "gate_paper":
      examYear = c.gateYear ?? 0;
      title = examYear ? `GATE ${examYear} · Mechanical Engineering` : `GATE · ${base}`;
      slugParts = ["gate", String(examYear || ""), "paper"];
      break;
    default:
      slugParts = [semLabel, base];
  }

  const id = `${slugify(slugParts.filter(Boolean).join(" "))}-${file.id.slice(0, 6)}`;

  const tags = [
    semLabel || (c.kind?.startsWith("gate") ? "GATE" : ""),
    subjectName,
    scheme,
    c.batch,
  ].filter(Boolean);

  const doc = {
    id,
    title,
    department: "Mechanical Engineering",
    program: "B.Tech",
    semester: c.semester ?? (c.kind?.startsWith("gate") ? "GATE" : ""),
    subject: subjectName,
    subjectCode,
    scheme,
    examYear,
    examMonth,
    type: c.kind ?? "unsorted",
    tags,
    driveFileId: file.id,
    preview: {
      fileSize: formatBytes(file.size),
      fileType: file.mimeType || "application/pdf",
    },
    download: { directDownloadAvailable: true },
    sourcePath: file.path.map(clean).join("/"),
  };
  if (c.batch) doc.batch = c.batch;
  if (file.resourceKey) doc.resourceKey = file.resourceKey;
  if (file.modifiedTime) doc.updatedAt = file.modifiedTime;

  return { doc, meta };
}

export function formatBytes(n) {
  const b = Number(n);
  if (!Number.isFinite(b) || b <= 0) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

/** Mask an email so personal addresses don't end up in committed reports. */
export function maskEmail(e) {
  const [user, domain] = String(e ?? "").split("@");
  if (!domain) return "unknown";
  return `${user.slice(0, 1)}***@${domain}`;
}

export function isMesacOwner(owner) {
  return !owner || owner.toLowerCase() === MESAC_OWNER;
}
