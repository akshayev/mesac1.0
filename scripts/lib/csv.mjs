// Minimal RFC 4180 CSV reader (no dependencies).
// Handles: quoted fields, commas and newlines inside quotes, "" escapes, CRLF/LF/CR, a leading BOM,
// and a missing trailing newline.

/**
 * Parse CSV text into rows of { cells, line } where `line` is the 1-based line the row starts on
 * (so reports point at the right spreadsheet row even when blank rows are dropped or cells contain newlines).
 * Fully empty rows are dropped.
 */
export function parseCsvWithLines(text) {
  const src = String(text ?? "").replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  let line = 1;
  let rowLine = 1;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((c) => c.trim() !== "")) rows.push({ cells: row, line: rowLine });
    row = [];
  };

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      if (ch === "\n") line++;
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === "") {
      inQuotes = true;
      i++;
    } else if (ch === ",") {
      endField();
      i++;
    } else if (ch === "\r") {
      endRow();
      i += src[i + 1] === "\n" ? 2 : 1;
      rowLine = ++line;
    } else if (ch === "\n") {
      endRow();
      i++;
      rowLine = ++line;
    } else {
      field += ch;
      i++;
    }
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

/** Parse CSV text into an array of rows (arrays of strings). Fully empty rows are dropped. */
export function parseCsv(text) {
  return parseCsvWithLines(text).map((r) => r.cells);
}

/** "Email Public" / " email_public " -> "email_public". */
export function normalizeHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Parse CSV text with a header row into objects keyed by snake_case header.
 * Each object also carries `_line` (1-based line number in the sheet, header = 1) for reports.
 * Unknown/blank headers are ignored; short rows are padded with "".
 */
export function parseCsvObjects(text) {
  const rows = parseCsvWithLines(text);
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].cells.map(normalizeHeader);
  const out = rows.slice(1).map(({ cells, line }) => {
    const obj = { _line: line };
    headers.forEach((h, c) => {
      if (h) obj[h] = (cells[c] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows: out };
}
