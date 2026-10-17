import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
const env = loadEnv("development", process.cwd(), "");
const db = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const admin = JSON.parse(readFileSync(".local/accounts.json", "utf8"))[0];
const file = ".local/itc-kolwezi-accounts.json";
const accounts = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
const persist = () => writeFileSync(file, JSON.stringify(accounts, null, 2));
const check = (r) => {
  if (r.error)
    throw Error(
      "Operation failed: " + (r.error.code || r.error.name || "request"),
    );
  return r.data;
};
async function account(role, email, name, schoolId, extra = {}) {
  const old = accounts.find((a) => a.email === email);
  if (old) return old;
  const result = check(
    await db.functions.invoke("web-manage-accounts", {
      body: {
        action: "create_" + role,
        email,
        name,
        school_ids: [schoolId],
        ...extra,
      },
    }),
  );
  if (!result?.password)
    throw Error("New account password not returned; manual review required");
  const record = { ...result, name, role, school_id: schoolId };
  accounts.push(record);
  persist();
  console.log("Created", role, name);
  return record;
}
try {
  check(
    await db.auth.signInWithPassword({
      email: admin.email,
      password: admin.password,
    }),
  );
  let school = check(
    await db
      .from("web_schools")
      .select("*")
      .eq("name", "I.T.C KOLWEZI")
      .maybeSingle(),
  );
  if (!school)
    school = check(
      await db
        .from("web_schools")
        .insert({
          name: "I.T.C KOLWEZI",
          full_name: "Institut technique du cinquantenaire de Kolwezi",
          city: "Kolwezi",
          academic_year: "2026-2027",
          currency: "CDF",
          terms: 3,
          periods_per_term: 2,
          student_email_domain: "itckolwezi.com",
          logo_key: "itc-kolwezi",
        })
        .select()
        .single(),
    );
  if (school.logo_key !== "itc-kolwezi")
    throw Error("Existing school requires review; refusing overwrite");
  const sid = school.id;
  writeFileSync(
    ".local/itc-kolwezi-school.json",
    JSON.stringify(school, null, 2),
  );
  for (const [role, local, name] of [
    ["subadmin", "sousadmin1", "Sous-administrateur ITC 1"],
    ["subadmin", "sousadmin2", "Sous-administrateur ITC 2"],
    ["finance", "finance", "Financier ITC"],
    ["gestionnaire", "gestionnaire", "Gestionnaire ITC"],
  ])
    await account(role, local + "@itckolwezi.example", name, sid);
  const classes = ["1ère technique (démo)", "2ème technique (démo)"];
  for (const name of classes) {
    const row = check(
      await db
        .from("web_classes")
        .select("id")
        .eq("school_id", sid)
        .eq("name", name)
        .maybeSingle(),
    );
    if (!row)
      check(await db.from("web_classes").insert({ school_id: sid, name }));
  }
  for (let i = 1; i <= 12; i++) {
    const num = String(i).padStart(2, "0");
    await account(
      "student",
      "eleve" + num + "@itckolwezi.com",
      "Élève démo ITC " + num,
      sid,
      {
        class_name: classes[i <= 6 ? 0 : 1],
        matricule: "ITC-DEMO-" + num,
        sex: i % 2 ? "M" : "F",
        birth_date: "2012-01-" + num,
      },
    );
  }
  const students = check(
    await db
      .from("web_students")
      .select("*")
      .eq("school_id", sid)
      .order("matricule"),
  );
  for (let i = 1; i <= 2; i++) {
    const children = students
      .filter((s, index) =>
        i === 1 ? [0, 1, 6].includes(index) : [2, 7].includes(index),
      )
      .map((s) => s.id);
    await account(
      "parent",
      "parent" + i + ".itc@suiviscolaire.example",
      "Parent démo ITC " + i,
      sid,
      { student_ids: children },
    );
  }
  const subjectNames = [
    "Mathématiques (démo)",
    "Français (démo)",
    "Sciences (démo)",
    "Technologie (démo)",
  ];
  for (const [index, name] of subjectNames.entries()) {
    let subject = check(
      await db
        .from("web_subjects")
        .select("*")
        .eq("school_id", sid)
        .eq("name", name)
        .maybeSingle(),
    );
    if (!subject)
      subject = check(
        await db
          .from("web_subjects")
          .insert({
            school_id: sid,
            name,
            domain:
              index < 2
                ? "FORMATION GÉNÉRALE (DÉMO)"
                : "FORMATION SCIENTIFIQUE ET TECHNIQUE (DÉMO)",
            period_max: 20,
            exam_max: 40,
            sort_order: index + 1,
          })
          .select()
          .single(),
      );
    for (const className of classes) {
      let assignment = check(
        await db
          .from("web_assignments")
          .select("*")
          .eq("school_id", sid)
          .eq("subject_id", subject.id)
          .eq("class_name", className)
          .eq("title", "Interrogation de démonstration")
          .maybeSingle(),
      );
      if (!assignment)
        assignment = check(
          await db
            .from("web_assignments")
            .insert({
              school_id: sid,
              subject_id: subject.id,
              class_name: className,
              title: "Interrogation de démonstration",
              kind: "interrogation",
              term: 1,
              period: 1,
              max_score: 20,
              due_date: "2026-10-17",
              published: false,
            })
            .select()
            .single(),
        );
      if (!assignment.published) {
        const entries = students
          .filter((s) => s.class_name === className)
          .map((s, i) => ({ student_id: s.id, score: 12 + ((i + index) % 8) }));
        check(
          await db.rpc("web_import_marks", {
            assignment: assignment.id,
            entries,
          }),
        );
        check(
          await db
            .from("web_assignments")
            .update({ published: true, published_at: new Date().toISOString() })
            .eq("id", assignment.id),
        );
      }
    }
  }
  for (const student of students) {
    const reference = "ITC-DEMO-RECU-" + student.matricule;
    if (
      !check(
        await db
          .from("web_payments")
          .select("id")
          .eq("school_id", sid)
          .eq("reference", reference)
          .maybeSingle(),
      )
    )
      check(
        await db
          .from("web_payments")
          .insert({
            school_id: sid,
            student_id: student.id,
            label: "Paiement fictif de démonstration",
            amount: 1000,
            currency: "CDF",
            paid_on: "2026-10-17",
            reference,
          }),
      );
  }
  writeFileSync(
    ".local/ITC_KOLWEZI_CREDENTIALS.md",
    "# I.T.C KOLWEZI — identifiants privés\n\nSite : https://suiviscolaire.info/#connexion\n\nCes comptes sont réservés aux essais. Les élèves, classes, notes et paiements sont fictifs. Les adresses de connexion ne créent pas de boîtes email.\n\n" +
      accounts
        .map(
          (a) =>
            "## " +
            a.name +
            " · " +
            a.role +
            "\n\nEmail : " +
            a.email +
            "\n\nMot de passe : " +
            a.password +
            "\n",
        )
        .join("\n"),
  );
  console.log(
    "Completed ITC: 2 subadmins, finance, gestionnaire, 12 students, 2 parents; private credentials saved.",
  );
} finally {
  await db.auth.signOut({ scope: "local" });
}
