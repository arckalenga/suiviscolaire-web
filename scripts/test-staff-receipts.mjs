import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const accounts = JSON.parse(readFileSync(".local/accounts.json", "utf8"));
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5176"],
  { stdio: "ignore", windowsHide: true },
);
const base = "http://127.0.0.1:5176/";
mkdirSync(".local/pdf-checks", { recursive: true });
let browser;
try {
  for (let i = 0; i < 30; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const errors = [];
  page.on("response", (r) => {
    if (r.status() >= 400)
      console.log("HTTP", r.status(), new URL(r.url()).pathname);
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.screenshot({
    path: ".local/pdf-checks/landing.png",
    fullPage: true,
  });
  for (const [index, role] of [
    [0, "admin"],
    [2, "subadmin"],
    [3, "student"],
  ]) {
    await page.goto(base + "#connexion");
    await page.getByLabel("Adresse e-mail").fill(accounts[index].email);
    await page
      .getByLabel("Mot de passe", { exact: true })
      .fill(accounts[index].password);
    await page
      .getByRole("button", { name: "Se connecter", exact: true })
      .click();
    await page.locator(".app").waitFor();
    if (role !== "student") {
      await page
        .locator(".school-card")
        .filter({ hasText: "Complexe scolaire du Fleuve" })
        .click();
    }
    await page.getByRole("button", { name: "Bulletins", exact: true }).click();
    await page.locator(".bulletin").waitFor();
    assert.ok((await page.locator(".maxima").innerText()).includes("3360"));
    assert.equal(await page.locator(".report-table td small").count(), 0);
    assert.equal(await page.locator(".subject-row").count(), 19);
    const first = page.locator(".subject-row").first();
    assert.equal(await first.locator("td").nth(1).innerText(), "20");
    assert.ok(!(await first.locator("td").nth(2).innerText()).includes("/"));
    assert.equal(await page.locator(".domain-subtotal").count(), 5);
    const reportText = await page.locator(".bulletin").innerText();
    for (const label of [
      "MAXIMA GÉNÉRAUX",
      "TOTAUX",
      "POURCENTAGE",
      "PLACE DE L’ÉLÈVE",
      "APPLICATION",
      "CONDUITE DE L’ÉLÈVE",
      "SIGNATURE DU RESPONSABLE",
    ])
      assert.ok(reportText.includes(label));
    assert.ok(
      !reportText.includes("MODÈLE DE DÉMONSTRATION") &&
        !reportText.includes("Seules les évaluations"),
    );
    await page
      .locator(".bulletin")
      .screenshot({ path: ".local/pdf-checks/" + role + "-report.png" });
    const downloading = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Télécharger le PDF", exact: true })
      .click();
    const download = await downloading;
    assert.match(download.suggestedFilename(), /^bulletin-.*\.pdf$/);
    await download.saveAs(".local/pdf-checks/" + role + ".pdf");
    console.log("PASS: " + role + " downloads bulletin PDF");
    await page.getByRole("button", { name: "Paiements", exact: true }).click();
    const receiptDownload=page.waitForEvent("download");
    await page.getByRole("button", {name:"Reçu PDF",exact:true}).first().click();
    await (await receiptDownload).saveAs(".local/pdf-checks/receipt-"+role+".pdf");
    if(role!=="student"){
      await page.getByRole("button",{name:"Personnel & salaires",exact:true}).click();
      await page.getByRole("heading",{name:"Personnel et branches",exact:true}).waitFor();
      await page.screenshot({path:".local/pdf-checks/personnel-"+role+".png",fullPage:true});
    }else assert.equal(await page.getByRole("button",{name:"Personnel & salaires",exact:true}).count(),0);
    console.log("PASS: "+role+" receipt and personnel access");
    if (role === "admin") {
      await page.getByRole("button", { name: "Élèves", exact: true }).click();
      await page.getByText("Ajouter un élève", { exact: true }).click();
      await page.getByLabel("Nom complet", { exact: true }).fill("Kalenga");
      assert.equal(
        await page
          .getByLabel("Email de connexion", { exact: true })
          .inputValue(),
        "kalenga@csfleuve.com",
      );
      await page.screenshot({
        path: ".local/pdf-checks/admin.png",
        fullPage: true,
      });
    }
    if (role === "student") {
      await page
        .getByRole("navigation")
        .getByRole("button", { name: "Vue d’ensemble", exact: true })
        .click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: ".local/pdf-checks/student-mobile.png",
        fullPage: true,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page
      .getByRole("button", { name: "Se déconnecter", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Se connecter", exact: true })
      .waitFor();
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: school email preview, responsive student workspace, no runtime errors.",
  );
} finally {
  await browser?.close();
  server.kill();
}
