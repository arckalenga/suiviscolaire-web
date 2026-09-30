import test from "node:test";
import assert from "node:assert/strict";
import { validateAttendance, financeTotals } from "../src/school-operations.ts";
import {
  eligibleRecipient,
  deliveryText,
} from "../supabase/functions/web-delivery/delivery-policy.ts";
test("attendance rejects blank statuses, duplicates and another class", () => {
  const people = [{ id: "a", name: "Alice", matricule: "A1" }];
  const r = validateAttendance(
    [
      { matricule: "A1", statut: "Présent" },
      { matricule: "A1", statut: "Absent" },
      { matricule: "B1", statut: "Retard" },
      { matricule: "Z1", statut: "" },
    ],
    people,
    "student",
  );
  assert.equal(r[0].status, "present");
  assert.equal(r[0].errors.length, 0);
  assert.ok(r[1].errors.some((e) => e.includes("double")));
  assert.ok(r[2].errors.some((e) => e.includes("inconnue")));
  assert.ok(r[3].errors.some((e) => e.includes("Statut")));
});
test("worker import uses immutable identifiers and validates note length", () => {
  const r = validateAttendance(
    [
      {
        identifiant: "w",
        statut: "Absence justifiée",
        observation: "x".repeat(501),
      },
    ],
    [{ id: "w", name: "Guard" }],
    "worker",
  );
  assert.equal(r[0].status, "excused");
  assert.equal(r[0].errors.length, 1);
});
test("financial totals keep currencies separate and round cents", () => {
  assert.deepEqual(
    financeTotals(
      [
        { currency: "USD", amount: "0.10" },
        { currency: "USD", amount: "0.20" },
        { currency: "CDF", amount: 1000 },
      ],
      [{ currency: "USD", amount: "0.10" }],
    ),
    [
      { currency: "CDF", received: 1000, paid: 0, net: 1000 },
      { currency: "USD", received: 0.3, paid: 0.1, net: 0.2 },
    ],
  );
});
const student = {
    id: "s",
    school_id: "school",
    class_name: "P1",
    archived: false,
  },
  contact = { student_id: "s", school_id: "school" };
test("notifications target only published marks with a recorded result", () => {
  const event = { school_id: "school", class_name: "P1", published: true };
  assert.equal(eligibleRecipient("mark", event, contact, student, true), true);
  assert.equal(
    eligibleRecipient("mark", event, contact, student, false),
    false,
  );
  assert.equal(
    eligibleRecipient(
      "mark",
      { ...event, published: false },
      contact,
      student,
      true,
    ),
    false,
  );
  assert.equal(
    eligibleRecipient(
      "mark",
      event,
      { ...contact, school_id: "other" },
      student,
      true,
    ),
    false,
  );
  assert.equal(
    eligibleRecipient(
      "mark",
      event,
      contact,
      { ...student, archived: true },
      true,
    ),
    false,
  );
  assert.ok(
    !deliveryText("mark", { score: 17.5 }, "School", "Student").text.includes(
      "17.5",
    ),
  );
});
test("communication and receipt recipient checks isolate classes and workers", () => {
  assert.equal(
    eligibleRecipient(
      "message",
      { school_id: "school", audience: "class", class_name: "P2" },
      contact,
      student,
    ),
    false,
  );
  assert.equal(
    eligibleRecipient(
      "message",
      { school_id: "school", audience: "student", student_id: "s" },
      contact,
      student,
    ),
    true,
  );
  assert.equal(
    eligibleRecipient(
      "payment",
      { school_id: "school", student_id: "other" },
      contact,
      student,
    ),
    false,
  );
  assert.equal(
    eligibleRecipient(
      "staff_payment",
      { school_id: "school", worker_id: "w" },
      { school_id: "school", worker_id: "w" },
    ),
    true,
  );
  assert.equal(
    eligibleRecipient(
      "staff_payment",
      { school_id: "school", worker_id: "z" },
      { school_id: "school", worker_id: "w" },
    ),
    false,
  );
});
