import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeHeader, parseCsv, parseCsvObjects } from "../lib/csv.mjs";

test("plain rows", () => {
  assert.deepEqual(parseCsv("a,b,c\n1,2,3\n"), [["a", "b", "c"], ["1", "2", "3"]]);
});

test("quoted commas stay in one field", () => {
  assert.deepEqual(parseCsv('name,role\n"Doe, Jane",Lead\n'), [["name", "role"], ["Doe, Jane", "Lead"]]);
});

test("quoted newlines stay in one field", () => {
  assert.deepEqual(parseCsv('a,b\n"line1\nline2",x\n'), [["a", "b"], ["line1\nline2", "x"]]);
});

test("escaped quotes", () => {
  assert.deepEqual(parseCsv('a\n"She said ""hi"""\n'), [["a"], ['She said "hi"']]);
});

test("CRLF, lone CR, BOM and no trailing newline", () => {
  assert.deepEqual(parseCsv("﻿a,b\r\n1,2\r\n3,4"), [["a", "b"], ["1", "2"], ["3", "4"]]);
  assert.deepEqual(parseCsv("a,b\r1,2"), [["a", "b"], ["1", "2"]]);
});

test("empty cells, empty rows and trailing commas", () => {
  assert.deepEqual(parseCsv("a,b,c\n1,,\n\n,,\n2,3,4\n"), [["a", "b", "c"], ["1", "", ""], ["2", "3", "4"]]);
});

test("a quote inside an unquoted field is kept literally", () => {
  assert.deepEqual(parseCsv('a\n5" pipe\n'), [["a"], ['5" pipe']]);
});

test("headers are normalised to snake_case", () => {
  assert.equal(normalizeHeader(" Email Public "), "email_public");
  assert.equal(normalizeHeader("LinkedIn"), "linkedin");
});

test("objects carry sheet line numbers and pad short rows", () => {
  const { headers, rows } = parseCsvObjects("Name,Role\nAda\n\nBob,Lead\n");
  assert.deepEqual(headers, ["name", "role"]);
  assert.equal(rows[0].name, "Ada");
  assert.equal(rows[0].role, "");
  assert.equal(rows[0]._line, 2);
  assert.equal(rows[1]._line, 4);
});

test("line numbers count blank rows and newlines inside quoted cells", () => {
  const { rows } = parseCsvObjects('name,note\nAda,"two\nlines"\n\nBob,x\n');
  assert.deepEqual(rows.map((r) => r._line), [2, 5]);
});
