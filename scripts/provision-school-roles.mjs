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
const file = ".local/finance-management-credentials.json";
const credentials = existsSync(file)
  ? JSON.parse(readFileSync(file, "utf8"))
  : [];
function check(r) {
  if (r.error)
    throw Error(
      "Operation failed: " + (r.error.code || r.error.name || "request"),
    );
  return r.data;
}
try {
  check(
    await db.auth.signInWithPassword({
      email: admin.email,
      password: admin.password,
    }),
  );
  const schools = check(
    await db.from("web_schools").select("id,name").order("name"),
  );
  const staff = check(await db.from("web_staff").select("email"));
  for (const school of schools)
    for (const role of ["finance", "gestionnaire"]) {
      const email =
        role + "." + school.id.slice(0, 8) + "@suiviscolaire.example";
      if (
        staff.some((s) => s.email === email) ||
        credentials.some((s) => s.email === email)
      ) {
        console.log("Already exists:", role, school.name);
        continue;
      }
      const r = check(
        await db.functions.invoke("web-manage-accounts", {
          body: {
            action: "create_" + role,
            name:
              (role === "finance" ? "Financier" : "Gestionnaire") +
              " · " +
              school.name,
            email,
            school_ids: [school.id],
          },
        }),
      );
      if (!r?.password) throw Error("Account creation failed");
      credentials.push({
        ...r,
        role,
        school_id: school.id,
        school_name: school.name,
      });
      writeFileSync(file, JSON.stringify(credentials, null, 2));
      console.log("Created:", role, school.name);
    }
  writeFileSync(
    ".local/FINANCE_GESTION_CREDENTIALS.md",
    "# Comptes de test — document privé\n\n" +
      credentials
        .map(
          (c) =>
            "## " +
            c.school_name +
            " · " +
            c.role +
            "\n\nEmail : " +
            c.email +
            "\n\nMot de passe : " +
            c.password +
            "\n",
        )
        .join("\n"),
  );
  console.log("Credentials saved only in ignored .local files.");
} finally {
  await db.auth.signOut({ scope: "local" });
}
