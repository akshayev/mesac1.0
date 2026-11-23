import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildDocument,
  classifyPath,
  clean,
  matchSubject,
  normSubject,
  parsePaperName,
} from "../lib/parse.mjs";

const root = new URL("../../", import.meta.url);
const subjects = JSON.parse(readFileSync(new URL("src/data/subjects.json", root), "utf8"));
const fixture = JSON.parse(
  readFileSync(new URL("scripts/fixtures/drive-sample.json", root), "utf8"),
).files;

const toFile = (f) => ({ ...f, path: f.path.split("/") });
const build = (path, id = "ABCDEFGHIJ") =>
  buildDocument({ path: path.split("/"), id, size: 1000 }, subjects);

test("clean and normSubject handle messy spacing and ampersands", () => {
  assert.equal(clean("  Syllabus  "), "Syllabus");
  assert.equal(clean(" 2024-28   Batch"), "2024-28 Batch");
  assert.equal(normSubject("Vibration&Noise Control"), normSubject("Vibration and Noise Control"));
  assert.equal(normSubject("Linear Algebra & Technology"), "linearalgebraandtechnology");
});

// Every sample paper name and the expected { year, month, scheme }.
const PAPERS = [
  ["Thermal Engineering 2024 June   (2019 Ad)_0001.pdf", "Thermal Engineering", 2024, "June"],
  ["Thermal Engineering 2023 Janu  (2019 Ad).pdf", "Thermal Engineering", 2023, "January"],
  ["Thermal Engineering 2022 Sept (2019 Ad).pdf", "Thermal Engineering", 2022, "September"],
  ["Thermal Engineering 2021 Nov (2019 Ad).pdf", "Thermal Engineering", 2021, "November"],
  [
    "Machine Science and Machine Tools   2021  Nov  (2019 Ad).pdf",
    "Machine Science and Machine Tools",
    2021,
    "November",
  ],
  [
    "Machine Science and Machine Tools   2022  Sept  (2019 Ad).pdf",
    "Machine Science and Machine Tools",
    2022,
    "September",
  ],
  [
    "Machine Science and Machine Tools   2023 Janu  (2019 Ad).pdf",
    "Machine Science and Machine Tools",
    2023,
    "January",
  ],
  [
    "Machine Science and Machine Tools 2024 June (2019 Ad.).pdf",
    "Machine Science and Machine Tools",
    2024,
    "June",
  ],
  [
    "Machine Science and Machine Tools 2025 Nov (2019 Ad.).pdf",
    "Machine Science and Machine Tools",
    2025,
    "November",
  ],
  [
    "Refrigeration and Air Conditioning 2023 Nov(2019Ad.).pdf",
    "Refrigeration and Air Conditioning",
    2023,
    "November",
  ],
  [
    "Refrigeration and Air Conditioning 2023 March (2019 Ad).pdf",
    "Refrigeration and Air Conditioning",
    2023,
    "March",
  ],
  ["Machine Design I 2022 April (2019 Ad. ).pdf", "Machine Design I", 2022, "April"],
  ["Fluid Mechanics  2022 Feb (2019 Ad).pdf", "Fluid Mechanics", 2022, "February"],
  ["Fluid Mechanics  2023 Nov (2019 Ad).pdf", "Fluid Mechanics", 2023, "November"],
  ["Fluid Mechanics  2024 July  (2019 Ad).pdf", "Fluid Mechanics", 2024, "July"],
];

for (const [name, subject, year, month] of PAPERS) {
  test(`parsePaperName: ${name}`, () => {
    assert.deepEqual(parsePaperName(name), { subject, year, month, scheme: "2019 scheme" });
  });
}

test("parsePaperName returns null for non-conforming names", () => {
  assert.equal(parsePaperName("1st internals qp.pdf"), null);
  assert.equal(parsePaperName("GATE2024.pdf"), null);
});

test("every fixture PYQ resolves to a known subject with no unparsed names", () => {
  for (const f of fixture) {
    const { doc, meta } = buildDocument(toFile(f), subjects);
    if (meta.kind !== "question_paper") continue;
    assert.equal(meta.unparsed, false, f.path);
    assert.equal(meta.unmatchedSubject, "", f.path);
    assert.equal(doc.scheme, "2019 scheme", f.path);
  }
});

test("folder aliases map to canonical subjects", () => {
  const cases = [
    ["Machine Tools", 5, "Machine Science and Machine Tools"],
    ["RAC", 7, "Refrigeration and Air Conditioning"],
    ["Machine Design 1", 6, "Machine Design I"],
    ["Fluid Mechanics ", 3, "Fluid Mechanics"],
    ["Thermal Engg", 5, "Thermal Engineering"],
    ["Vibration&Noise Control", 7, "Vibration and Noise Control"],
  ];
  for (const [raw, sem, name] of cases) {
    assert.equal(matchSubject(raw, sem, subjects)?.name, name, raw);
  }
  assert.equal(matchSubject("Underwater Basket Weaving", 5, subjects), null);
});

test("PYQ with subject + scheme folder", () => {
  const { doc } = build(
    "S1-8/S5/PYQ/Thermal Engineering/2019 scheme/Thermal Engineering 2021 Nov (2019 Ad).pdf",
    "1M6LYe8EM_TwnN3VSuo2hhMwJmZI2_wta",
  );
  assert.equal(doc.type, "question_paper");
  assert.equal(doc.semester, 5);
  assert.equal(doc.subject, "Thermal Engineering");
  assert.equal(doc.examYear, 2021);
  assert.equal(doc.examMonth, "November");
  assert.equal(doc.title, "Thermal Engineering · November 2021");
  assert.equal(doc.id, "s5-thermal-engineering-2021-nov-1M6LYe");
});

test("loose internal file directly under S3/PYQ is an internal paper", () => {
  const { doc, meta } = build("S1-8/S3/PYQ/2025 scheme S3 First internal.pdf");
  assert.equal(meta.kind, "internal_paper");
  assert.equal(doc.semester, 3);
  assert.equal(doc.scheme, "2025 scheme");
  assert.equal(doc.title, "S3 · 1st internal · 2025 scheme");
  assert.equal(meta.unmatchedSubject, "");
});

test("S8 PYQ with scheme folder and no subject level takes the subject from the name", () => {
  const { doc, meta } = build("S1-8/S8/PYQ/2019 Scheme/Machine Design II 2024 April (2019 Ad).pdf");
  assert.equal(meta.kind, "question_paper");
  assert.equal(doc.semester, 8);
  assert.equal(doc.scheme, "2019 scheme");
  assert.equal(doc.subject, "Machine Design II");
  assert.equal(doc.examYear, 2024);
});

test("S8 PYQ with unknown subject keeps the cleaned name and is reported", () => {
  const { doc, meta } = build("S1-8/S8/PYQ/2019 Scheme/Power  Plant Engg 2024 April (2019 Ad).pdf");
  assert.equal(doc.subject, "Power Plant Engg");
  assert.equal(meta.unmatchedSubject, "Power Plant Engg");
});

test("Internals folder builds a title from the path", () => {
  const { doc } = build("S1-8/S5/Internals /Thermal Engg/ 2024-28 Batch/1st internals qp.pdf");
  assert.equal(doc.type, "internal_paper");
  assert.equal(doc.subject, "Thermal Engineering");
  assert.equal(doc.batch, "2024-28 batch");
  assert.equal(doc.title, "Thermal Engineering · 1st internal · 2024-28 batch");
});

test("notes, syllabus and lab layouts", () => {
  const notes = build("S1-8/S6/Notes/Heat Mass Transfer/2023-27 Batch/Module 1.pdf").doc;
  assert.equal(notes.type, "notes");
  assert.equal(notes.subject, "Heat and Mass Transfer");
  assert.equal(notes.batch, "2023-27 batch");

  const syl = build("S1-8/S4/Syllabus /2019 Scheme/S4 syllabus.pdf").doc;
  assert.equal(syl.type, "syllabus");
  assert.equal(syl.scheme, "2019 scheme");

  const lab = build("S1-8/S5/LAB/ Heat Engines Lab/Manual.pdf").doc;
  assert.equal(lab.type, "lab_manual");
  assert.equal(lab.subject, "Heat Engines Lab");
});

test("Data Book and GATE study material are hidden; GATE PYQ is visible", () => {
  assert.equal(
    classifyPath("S1-8/S7/Data Book/Refrigeration Data Book.pdf".split("/")).hidden,
    true,
  );
  assert.equal(classifyPath("GATE/Study Material /Heat Transfer.pdf".split("/")).hidden, true);
  const gate = build("GATE/PYQ/2024/GATE2024.pdf").doc;
  assert.equal(gate.type, "gate_paper");
  assert.equal(gate.semester, "GATE");
  assert.equal(gate.examYear, 2024);
});

test("unknown layouts are left unclassified", () => {
  assert.equal(classifyPath("Random/thing.pdf".split("/")).kind, null);
  assert.equal(classifyPath("S1-8/S5/Misc/thing.pdf".split("/")).kind, null);
});

test("fixture ids are unique", () => {
  const ids = fixture.map((f) => buildDocument(toFile(f), subjects).doc.id);
  assert.equal(new Set(ids).size, ids.length);
});
