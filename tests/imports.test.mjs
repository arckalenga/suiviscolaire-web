import test from "node:test";
import assert from "node:assert/strict";
import {
  validateStudents,
  validateMarks,
  readWorkbook,
} from "../src/imports.ts";
import * as XLSX from "xlsx";
test("student import detects duplicates, unknown classes and invalid dates", () => {
  const rows = validateStudents(
    [
      {
        nom: "Test Élève",
        matricule: "A1",
        email: "a@demo.example",
        classe: "P1",
        sexe: "F",
        naissance: "2018-02-30",
      },
      {
        nom: "Test Élève",
        matricule: "A1",
        email: "a@demo.example",
        classe: "Other",
        sexe: "X",
        naissance: "",
      },
    ],
    ["P1"],
    [],
  );
  assert.ok(rows[0].errors.some((e) => e.includes("Date")));
  assert.ok(rows[1].errors.some((e) => e.includes("Matricule")));
  assert.ok(rows[1].errors.some((e) => e.includes("Email")));
  assert.ok(rows[1].errors.some((e) => e.includes("Classe")));
});
test("mark import preserves zero and ignores blanks", () => {
  const rows = validateMarks(
    [
      { matricule: "A1", note: "0" },
      { matricule: "A2", note: "" },
      { matricule: "A3", note: "12,5" },
    ],
    [
      { id: "1", matricule: "A1" },
      { id: "2", matricule: "A2" },
      { id: "3", matricule: "A3" },
    ],
    20,
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].score, 0);
  assert.equal(rows[1].score, 12.5);
  assert.ok(rows.every((r) => !r.errors.length));
});
test("marks reject out-of-class students, duplicates and scores above maximum", () => {
  const rows = validateMarks(
    [
      { matricule: "OTHER", note: "12" },
      { matricule: "A1", note: "21" },
      { matricule: "A1", note: "2" },
    ],
    [{ id: "1", matricule: "A1" }],
    20,
  );
  assert.ok(rows.every((r) => r.errors.length));
});
test("real xlsx workbook roundtrip", async () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet([{ Matricule: "A1", Note: 0 }]),
    "Notes",
  );
  const rows = await readWorkbook(
    new File(
      [XLSX.write(book, { type: "buffer", bookType: "xlsx" })],
      "notes.xlsx",
    ),
  );
  assert.deepEqual(rows, [{ matricule: "A1", note: "0" }]);
});
test("formula workbook rejected without evaluation", async () => {
  const book = XLSX.utils.book_new(),
    sheet = XLSX.utils.aoa_to_sheet([
      ["Matricule", "Note"],
      ["A1", 1],
    ]);
  sheet.B2 = { t: "n", f: "1+1", v: 2 };
  XLSX.utils.book_append_sheet(book, sheet, "Notes");
  await assert.rejects(
    () =>
      readWorkbook(
        new File(
          [XLSX.write(book, { type: "buffer", bookType: "xlsx" })],
          "notes.xlsx",
        ),
      ),
    /formules/,
  );
});

test("Excel birth dates retain their calendar day in local time", async () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet([
      { Matricule: "A1", Naissance: new Date(2018, 0, 15) },
    ]),
    "Eleves",
  );
  const rows = await readWorkbook(
    new File(
      [XLSX.write(book, { type: "buffer", bookType: "xlsx" })],
      "eleves.xlsx",
    ),
  );
  assert.equal(rows[0].naissance, "2018-01-15");
});
