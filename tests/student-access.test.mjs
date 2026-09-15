import test from "node:test";
import assert from "node:assert/strict";
import {
  studentEmail,
  studentPassword,
} from "../supabase/functions/web-manage-accounts/student-access.ts";
import { validateStudents } from "../src/imports.ts";
test("student passwords have exactly six unambiguous random characters", () => {
  const passwords = new Set(Array.from({ length: 1000 }, studentPassword));
  assert.equal(passwords.size, 1000);
  for (const p of passwords) assert.match(p, /^[A-HJ-NP-Z2-9]{6}$/);
});
test("school login identifiers normalize accents and preserve the configured domain", () => {
  assert.equal(studentEmail("Kalenga", "csfleuve.com"), "kalenga@csfleuve.com");
  assert.equal(
    studentEmail("Grâce Kabeya", "csfleuve.com"),
    "grace.kabeya@csfleuve.com",
  );
});
test("Excel generates omitted logins, detects homonyms and rejects wrong school domains", () => {
  const out = validateStudents(
    [
      { nom: "Kalenga", matricule: "A1", classe: "P1", email: "" },
      { nom: "Kalenga", matricule: "A2", classe: "P1", email: "" },
      {
        nom: "Moise",
        matricule: "A3",
        classe: "P1",
        email: "moise@different.com",
      },
    ],
    ["P1"],
    [],
    "csfleuve.com",
  );
  assert.equal(out[0].email, "kalenga@csfleuve.com");
  assert.deepEqual(out[0].errors, []);
  assert.ok(out[1].errors.includes("Email déjà utilisé"));
  assert.ok(out[2].errors.includes("Utilisez @csfleuve.com"));
});
