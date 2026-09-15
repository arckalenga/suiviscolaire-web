import test from "node:test";
import assert from "node:assert/strict";
import { reportModel } from "../src/report-model.ts";
const school = { terms: 3, periods_per_term: 2 };
const student = { id: "u", class_name: "P1" };
const subjects = [{ id: "s", period_max: 20, exam_max: 40 }];
test("separate configured maxima and weighted points, preserving missing and zero marks", () => {
  const data = {
    subjects,
    assignments: [
      {
        id: "a",
        published: true,
        class_name: "P1",
        subject_id: "s",
        term: 1,
        period: 1,
        max_score: 10,
      },
      {
        id: "b",
        published: true,
        class_name: "P1",
        subject_id: "s",
        term: 1,
        period: 1,
        max_score: 30,
      },
      {
        id: "zero",
        published: true,
        class_name: "P1",
        subject_id: "s",
        term: 1,
        period: 2,
        max_score: 20,
      },
      {
        id: "draft",
        published: false,
        class_name: "P1",
        subject_id: "s",
        term: 1,
        period: 0,
        max_score: 40,
      },
    ],
    marks: [
      { student_id: "u", assignment_id: "a", score: 5 },
      { student_id: "u", assignment_id: "b", score: 15 },
      { student_id: "u", assignment_id: "zero", score: 0 },
    ],
  };
  const m = reportModel(school, student, data);
  assert.equal(m.columns.length, 23);
  assert.deepEqual(
    m.columns.slice(0, 7).map((c) => c.value(subjects)),
    [20, 10, 0, 40, null, 80, null],
  );
  assert.equal(m.maxima.at(-2), 240);
  assert.equal(m.totals.at(-1), null);
  assert.equal(m.percentages[1], 50);
  assert.equal(m.percentages[2], 0);
  data.marks.pop();
  assert.equal(reportModel(school, student, data).totals[2], null);
});
test("RDC configuration totals 280 per period, 560 per exam and 3360 annually", () => {
  const m = reportModel(school, student, {
    subjects: [{ id: "all", period_max: 280, exam_max: 560 }],
    assignments: [],
    marks: [],
  });
  assert.equal(m.maxima[0], 280);
  assert.equal(m.maxima[3], 560);
  assert.equal(m.maxima[5], 1120);
  assert.equal(m.maxima.at(-2), 3360);
});
test("configured periods and terms determine annual maxima and column groups", () => {
  const m = reportModel({ terms: 4, periods_per_term: 4 }, student, {
    subjects,
    assignments: [],
    marks: [],
  });
  assert.equal(m.columns.length, 38);
  assert.equal(m.maxima.at(-2), 480);
});
