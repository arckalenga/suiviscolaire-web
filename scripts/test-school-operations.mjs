import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
const accounts = JSON.parse(readFileSync(".local/accounts.json", "utf8"));
const roles = JSON.parse(
  readFileSync(".local/finance-management-credentials.json", "utf8"),
);
const school = "Complexe scolaire du Fleuve";
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5176"],
  { stdio: "ignore", windowsHide: true },
);
let browser;
const errors = [];
mkdirSync(".local/operations-checks", { recursive: true });
try {
  for (let i = 0; i < 30; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5176")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  browser = await chromium.launch({ channel: "msedge", headless: true });
  for (const [role, account] of [
    [
      "finance",
      roles.find((r) => r.role === "finance" && r.school_name === school),
    ],
    [
      "gestionnaire",
      roles.find((r) => r.role === "gestionnaire" && r.school_name === school),
    ],
    ["subadmin", accounts[2]],
    ["admin", accounts[0]],
    ["student", accounts[3]],
  ]) {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        acceptDownloads: true,
      }),
      page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on("pageerror", (e) => errors.push(role + ": " + e.message));
    await page.goto("http://127.0.0.1:5176/#connexion");
    await page.getByLabel("Adresse e-mail").fill(account.email);
    await page
      .getByLabel("Mot de passe", { exact: true })
      .fill(account.password);
    await page
      .getByRole("button", { name: "Se connecter", exact: true })
      .click();
    await page.locator(".app").waitFor();
    if (role !== "student") {
      await page.locator(".school-card").filter({ hasText: school }).click();
    }
    await page
      .getByRole("heading", { name: "Vue d’ensemble", exact: true })
      .waitFor();
    if (role === "student") {
      assert.equal(
        await page
          .getByRole("navigation")
          .getByRole("button", { name: "Suivi financier", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("navigation")
          .getByRole("button", { name: "Présences", exact: true })
          .count(),
        0,
      );
    } else {
      await page
        .getByRole("navigation")
        .getByRole("button", { name: "Suivi financier", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Journal des opérations récentes" })
        .waitFor();
      await page.getByLabel("Du", { exact: true }).fill("2020-01-01");
      await page.getByLabel("Au", { exact: true }).fill("2030-12-31");
      assert.equal(
        await page.getByRole("heading", { name: "CDF", exact: true }).count(),
        1,
      );
      await page.screenshot({
        path: ".local/operations-checks/" + role + "-finance.png",
        fullPage: true,
      });
      await page
        .getByRole("navigation")
        .getByRole("button", { name: "Présences", exact: true })
        .click();
      await page
        .getByRole("heading", { name: /Feuille de présence/ })
        .waitFor();
      await page
        .getByText("Chargement…", { exact: true })
        .waitFor({ state: "hidden" });
      if (["subadmin", "admin"].includes(role)) {
        assert.ok(
          (await page.getByRole("combobox", { name: /Présence de/ }).count()) >
            0,
        );
        await page
          .getByRole("combobox", { name: /Présence de/ })
          .first()
          .selectOption("present");
        assert.equal(
          await page
            .getByRole("button", { name: "Enregistrer les modifications (1)" })
            .isEnabled(),
          true,
        );
        await page
          .getByText("Importer les présences depuis Excel", { exact: true })
          .click();
        const dl = page.waitForEvent("download");
        await page
          .getByRole("button", {
            name: "Télécharger le modèle Excel",
            exact: true,
          })
          .click();
        const download = await dl;
        const path = await download.path();
        const book = XLSX.read(readFileSync(path), { type: "buffer" });
        const data = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]]);
        assert.ok(data.length > 0);
        data[0].Statut = "Présent";
        const sheet = XLSX.utils.json_to_sheet([data[0]]),
          wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, "Présences");
        await page
          .getByLabel("Fichier Excel")
          .setInputFiles({
            name: "attendance.xlsx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            buffer: XLSX.write(wb, { type: "buffer", bookType: "xlsx" }),
          });
        await page.getByText("Valide", { exact: true }).waitFor();
        assert.equal(
          await page
            .getByRole("button", {
              name: "Confirmer l’import (1)",
              exact: true,
            })
            .isEnabled(),
          true,
        );
      } else {
        assert.equal(
          await page.getByRole("combobox", { name: /Présence de/ }).count(),
          0,
        );
        assert.equal(
          await page
            .getByRole("button", { name: /Enregistrer les modifications/ })
            .count(),
          0,
        );
      }
      await page.screenshot({
        path: ".local/operations-checks/" + role + "-attendance.png",
        fullPage: true,
      });
      await page
        .getByRole("navigation")
        .getByRole("button", { name: "Personnel & salaires", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Personnel et branches", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByText("Enregistrer un paiement au personnel", { exact: true })
          .count(),
        ["finance", "admin"].includes(role) ? 1 : 0,
      );
      assert.equal(
        await page
          .getByText("Ajouter un enseignant ou travailleur", { exact: true })
          .count(),
        ["subadmin", "admin"].includes(role) ? 1 : 0,
      );
      await page
        .getByRole("navigation")
        .getByRole("button", { name: "Envois & contacts", exact: true })
        .click();
      await page
        .getByRole("heading", {
          name: "Envoi depuis le compte de l’établissement",
        })
        .waitFor();
      await page.waitForTimeout(800);
      assert.equal(
        await page.getByText("Non configuré", { exact: true }).count(),
        2,
      );
      assert.equal(
        await page
          .getByRole("heading", {
            name: "Destinataire d’un élève ou d’un membre du personnel",
            exact: true,
          })
          .count(),
        role === "gestionnaire" ? 0 : 1,
      );
      assert.equal(await page.locator(".alert").count(), 0);
    }
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Paiements", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Historique des paiements", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByText("Enregistrer un paiement reçu", { exact: true })
        .count(),
      ["finance", "admin"].includes(role) ? 1 : 0,
    );
    if (role === "finance") {
      const dl = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Reçu PDF", exact: true })
        .first()
        .click();
      await (await dl).saveAs(".local/operations-checks/finance-receipt.pdf");
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Mobile overflow for " + role,
    );
    await page
      .getByRole("button", { name: "Se déconnecter", exact: true })
      .click();
    await context.close();
    console.log("PASS UI:", role);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: receipt PDF, Excel template/preview, role controls, mobile, no runtime errors",
  );
} finally {
  await browser?.close();
  server.kill();
}
