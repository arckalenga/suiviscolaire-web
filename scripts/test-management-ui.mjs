import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import * as XLSX from "xlsx";
const accounts = JSON.parse(readFileSync(".local/accounts.json", "utf8"));
const run = "qa-ui-" + Date.now(),
  school = run,
  created = { run, users: [] };
const save = () => writeFileSync(".local/qa-ui.json", JSON.stringify(created));
save();
mkdirSync(".local/screenshots", { recursive: true });
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5176"],
  { stdio: "ignore", windowsHide: true },
);
const base = "http://127.0.0.1:5176/suiviscolaire-web/";
let browser,
  page,
  count = 0;
const check = (ok, label) => {
  if (!ok) throw Error(label);
  count++;
  console.log("PASS: " + label);
};
const form = (title) =>
  page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
const fill = async (f, values) => {
  for (const [name, value] of Object.entries(values))
    await f.locator('[name="' + name + '"]').fill(value);
};
const act = async (f, name) =>
  f.getByRole("button", { name, exact: true }).click();
async function login(a) {
  await page.goto(base + "#connexion");
  await page.getByLabel("Adresse e-mail", { exact: true }).fill(a.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(a.password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}
async function logout() {
  await page
    .getByRole("button", { name: "Se déconnecter", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Se connecter", exact: true })
    .waitFor();
}
async function createAccount(action, click) {
  const wait = page.waitForResponse(
    (r) =>
      r.url().includes("/functions/v1/web-manage-accounts") &&
      r.request().method() === "POST" &&
      r.request().postDataJSON()?.action === action,
  );
  await click();
  const r = await wait;
  const body = await r.json();
  if (r.status() !== 200) throw Error("Account creation failed");
  created.users.push(body);
  save();
  return body;
}
function workbook(rows, name) {
  const b = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(b, XLSX.utils.json_to_sheet(rows), "Données");
  return {
    name,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: XLSX.write(b, { type: "buffer", bookType: "xlsx" }),
  };
}
try {
  for (let i = 0; i < 30; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  page = await context.newPage();
  page.setDefaultTimeout(45000);
  page.on("dialog", (d) => d.accept());
  const errors = [];
  page.on("pageerror", () => errors.push("runtime"));
  await page.goto(base);
  await page
    .getByRole("heading", { name: "L’école connectée. La réussite partagée." })
    .waitFor();
  check(
    (await page.getByRole("link", { name: "Vision", exact: true }).count()) ===
      1,
    "Public vision navigation",
  );
  check(
    (await page
      .locator('a[href="https://www.instagram.com/acadexis_official"]')
      .count()) === 1,
    "Acadexis Instagram link",
  );
  check(
    (await page.locator('a[href="tel:+243994234000"]').count()) === 1,
    "DRC phone link",
  );
  check(
    (await page.locator('a[href="https://wa.me/27695922534"]').count()) === 1,
    "WhatsApp contact link",
  );
  await page.screenshot({
    path: ".local/screenshots/acadexis-home.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".local/screenshots/acadexis-home-mobile.png",
    fullPage: true,
  });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Welcome page fits mobile",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(accounts[0]);
  await page.getByRole("heading", { name: "Vos établissements" }).waitFor();
  await page.locator("summary").filter({ hasText: "Créer une école" }).click();
  let f = form("Nouvel établissement");
  await fill(f, {
    name: school,
    city: "Ville de test",
    academic_year: "2026-2027",
  });
  await act(f, "Créer l’école");
  await page.locator(".school-card").filter({ hasText: school }).waitFor();
  check(true, "Main admin creates school through UI");
  await page
    .locator("summary")
    .filter({ hasText: "Créer un sous-administrateur" })
    .click();
  f = form("Nouvel accès de gestion");
  await fill(f, {
    name: "QA UI Subadmin",
    email: run + "-staff@suiviscolaire.example",
  });
  await f.getByLabel(school, { exact: true }).check();
  const staff = await createAccount("create_subadmin", () =>
    act(f, "Créer le sous-administrateur"),
  );
  check(true, "Main admin creates scoped sub-admin through UI");
  await page.locator(".school-card").filter({ hasText: school }).click();
  await page.getByText("Élèves inscrits", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Classes & cours", exact: true })
    .click();
  f = form("Créer une classe");
  await fill(f, { name: "Classe test" });
  await act(f, "Enregistrer");
  await page
    .locator(".class-list")
    .getByText("Classe test", { exact: true })
    .waitFor();
  check(true, "Class creation");
  f = form("Ajouter une branche / un cours");
  await fill(f, {
    name: "Mathématiques test",
    domain: "MATHÉMATIQUES",
    period_max: "20",
    exam_max: "40",
  });
  await act(f, "Enregistrer");
  await page
    .getByRole("cell", { name: "Mathématiques test", exact: true })
    .waitFor();
  check(true, "Course creation");
  await logout();
  await login(staff);
  await page.locator(".school-card").first().waitFor();
  check(
    (await page.locator(".school-card").count()) === 1,
    "Created sub-admin sees assigned school",
  );
  await page.locator(".school-card").click();
  await page.getByText("Élèves inscrits", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Élèves", exact: true }).click();
  await page.locator("summary").filter({ hasText: "Ajouter un élève" }).click();
  f = form("Nouvel élève et accès personnel");
  await fill(f, {
    name: "Élève individuel",
    matricule: "UI-1",
    email: run + "-one@suiviscolaire.example",
    birth_date: "2018-01-15",
  });
  const pupil = await createAccount("create_student", () =>
    act(f, "Créer l’élève"),
  );
  await page
    .getByRole("cell", { name: "Élève individuel", exact: true })
    .waitFor();
  check(true, "Individual student and login creation");
  let row = page
    .locator("tr")
    .filter({ has: page.getByRole("cell", { name: "UI-1", exact: true }) });
  await row.getByRole("button", { name: "Modifier", exact: true }).click();
  f = form("Modifier · Élève individuel");
  await f.locator("[name=name]").fill("Élève modifié");
  await act(f, "Enregistrer");
  await page
    .getByRole("cell", { name: "Élève modifié", exact: true })
    .waitFor();
  check(true, "Student profile editing");
  const importRows = [2, 3].map((i) => ({
    Matricule: "UI-" + i,
    Nom: "Élève importé " + i,
    Classe: "Classe test",
    Email: run + "-" + i + "@suiviscolaire.example",
    Sexe: "F",
    Naissance: "2018-02-15",
  }));
  const captured = [];
  const capture = async (r) => {
    if (
      r.url().includes("/web-manage-accounts") &&
      r.request().method() === "POST" &&
      r.status() === 200 &&
      r.request().postDataJSON()?.action === "create_student"
    ) {
      const b = await r.json();
      if (b.user_id && !created.users.some((u) => u.user_id === b.user_id)) {
        created.users.push(b);
        save();
        captured.push(b);
      }
    }
  };
  page.on("response", capture);
  await page
    .getByLabel("Choisir le fichier élèves")
    .setInputFiles(workbook(importRows, "eleves.xlsx"));
  await page
    .getByRole("heading", { name: "Aperçu de l’import élèves · 2 lignes" })
    .waitFor();
  await page
    .getByRole("button", { name: "Confirmer l’import des élèves", exact: true })
    .click();
  await page
    .getByText("2 élève(s) créé(s). 0 ligne(s) à corriger.", { exact: true })
    .waitFor();
  await page
    .getByRole("cell", { name: "Élève importé 3", exact: true })
    .waitFor();
  check(true, "Excel students imported after preview");
  page.off("response", capture);
  row = page
    .locator("tr")
    .filter({ has: page.getByRole("cell", { name: "UI-1", exact: true }) });
  await row.getByRole("button", { name: "Retirer", exact: true }).click();
  await page.getByLabel("Inclure les élèves retirés").check();
  await row.getByRole("cell", { name: "Retiré", exact: true }).waitFor();
  await row.getByRole("button", { name: "Rétablir", exact: true }).click();
  await row.getByRole("cell", { name: "Actif", exact: true }).waitFor();
  check(true, "Student removal and restoration");
  await page
    .getByRole("button", { name: "Notes & devoirs", exact: true })
    .click();
  await page
    .locator("summary")
    .filter({ hasText: "Créer une évaluation" })
    .click();
  f = form("Nouvelle évaluation — brouillon");
  await fill(f, { title: "Interrogation UI", due_date: "2026-09-14" });
  await f.locator("[name=kind]").selectOption("interrogation");
  await act(f, "Créer l’évaluation");
  await page
    .getByRole("heading", { name: "Saisir une note", exact: true })
    .waitFor();
  await page.getByLabel("Choisir le fichier notes").setInputFiles(
    workbook(
      [
        { Matricule: "UI-1", Note: 0 },
        { Matricule: "UI-2", Note: 12.5 },
        { Matricule: "UI-3", Note: 20 },
      ],
      "notes.xlsx",
    ),
  );
  await page
    .getByRole("heading", { name: "Aperçu des notes", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Confirmer l’import des notes", exact: true })
    .click();
  await page
    .getByText("3 note(s) importée(s) en brouillon.", { exact: true })
    .waitFor();
  check(true, "Excel marks saved as drafts");
  await page
    .getByRole("button", { name: "Publier les notes et notifier", exact: true })
    .click();
  await page
    .getByText("Notes publiées : les élèves peuvent les consulter.", {
      exact: true,
    })
    .waitFor();
  check(true, "Explicit mark publication");
  await page
    .getByRole("button", { name: "Communications", exact: true })
    .click();
  await page
    .locator("summary")
    .filter({ hasText: "Publier une communication ciblée" })
    .click();
  f = form("Nouvelle communication");
  await fill(f, {
    title: "Message personnel UI",
    body: "Message réservé au premier élève.",
  });
  await f.locator("[name=audience]").selectOption("student");
  await f
    .locator("[name=student_id]")
    .selectOption({ label: "Élève modifié · UI-1" });
  await act(f, "Publier la communication");
  await page
    .getByRole("heading", { name: "Message personnel UI", exact: true })
    .waitFor();
  check(true, "Targeted student communication through UI");
  await logout();
  await login(pupil);
  await page.getByText("Moyenne des notes publiées", { exact: true }).waitFor();
  check(
    (await page.locator(".student-action").count()) === 7,
    "Student dashboard has seven action boxes",
  );
  await page.screenshot({
    path: ".local/screenshots/student-boxes.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Voir les points/ }).click();
  await page.getByRole("heading", { name: "Mes notes", exact: true }).waitFor();
  check(
    (await page.locator("tbody tr").textContent()).includes("0 / 20"),
    "Student sees published zero mark correctly",
  );
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Mes notifications", exact: true })
    .waitFor();
  check(
    (await page.locator(".notification").count()) === 2,
    "Student receives grade and targeted-message notifications",
  );
  await page
    .locator(".notification")
    .filter({ hasText: "Message personnel UI" })
    .getByRole("button", { name: "Consulter" })
    .click();
  await page
    .locator(".message-list")
    .getByRole("heading", { name: "Message personnel UI", exact: true })
    .waitFor();
  check(true, "Notification opens intended communication");
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await page.locator(".notification.read").waitFor();
  check(true, "Notification read state persists");
  await page
    .getByRole("button", { name: "Payer en ligne", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "Le paiement en ligne arrive prochainement.",
    })
    .waitFor();
  check(true, "Deferred online payment clearly labeled");
  await page
    .getByRole("button", { name: "Vue d’ensemble", exact: true })
    .first()
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".local/screenshots/student-boxes-mobile.png",
    fullPage: true,
  });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Student boxes fit mobile",
  );
  check(errors.length === 0, "No browser runtime errors in new workflows");
  await logout();
  console.log(count + " expanded browser checks passed.");
} catch (e) {
  if (page)
    await page.screenshot({
      path: ".local/screenshots/management-failure.png",
      fullPage: true,
    });
  console.error(
    "Expanded browser test failed: " +
      (e instanceof Error ? e.message.split("\n")[0] : "unknown"),
  );
  process.exitCode = 1;
} finally {
  save();
  if (browser) await browser.close();
  server.kill();
}
