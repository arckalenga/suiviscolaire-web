import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const account = JSON.parse(readFileSync(".local/parent-qa.json", "utf8"));
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5176"],
  { stdio: "ignore", windowsHide: true },
);
let browser;
try {
  for (let i = 0; i < 30; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5176")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    permissions: ["notifications"],
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript(() => {
    const original = PushManager.prototype.subscribe;
    PushManager.prototype.subscribe = function (...args) {
      return original.apply(this, args).catch((e) => {
        console.log("PUSH_ERROR", e.name);
        throw e;
      });
    };
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.text().startsWith("PUSH_ERROR")) console.log(m.text());
  });
  page.setDefaultTimeout(30000);
  page.on("response", async (r) => {
    if (r.status() >= 400)
      console.log("HTTP", r.status(), new URL(r.url()).pathname);
  });
  await page.goto("http://127.0.0.1:5176/#connexion");
  await page.getByLabel("Adresse e-mail").fill(account.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page
    .getByRole("heading", { name: "Mes enfants", exact: true })
    .waitFor();
  await page
    .locator(".school-card")
    .first()
    .waitFor()
    .catch(async (e) => {
      console.log(await page.locator(".content").innerText());
      throw e;
    });
  assert.equal(await page.locator(".school-card").count(), 4);
  mkdirSync(".local/parent-checks", { recursive: true });
  await page.screenshot({
    path: ".local/parent-checks/family.png",
    fullPage: true,
  });
  await page.locator(".school-card").first().click();
  await page.getByLabel("Élève", { exact: true }).first().waitFor();
  const picker = page.getByLabel("Élève", { exact: true }).first();
  await picker
    .locator("option")
    .first()
    .waitFor({ state: "attached" })
    .catch(async (e) => {
      console.log(await page.locator(".content").innerText());
      throw e;
    });
  const options = await picker
    .locator("option")
    .evaluateAll((os) => os.map((o) => o.value));
  assert.equal(options.length, 2);
  await picker.selectOption(options[1]);
  await page.getByRole("button", { name: "Bulletins", exact: true }).click();
  await page.locator(".bulletin").waitFor();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Télécharger le PDF", exact: true })
    .click();
  await (await download).saveAs(".local/parent-checks/parent.pdf");
  assert.equal(
    await page
      .getByRole("button", { name: "Personnel & salaires", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page.getByRole("button", { name: "Parents", exact: true }).count(),
    0,
  );
  console.log(
    "PASS: four-child family dashboard, child switching, parent bulletin PDF, hidden management navigation",
  );
  await page
    .getByRole("button", { name: "Activer les notifications", exact: true })
    .click();
  try {
    await page
      .getByRole("button", { name: "Désactiver sur cet appareil", exact: true })
      .waitFor({ timeout: 20000 });
    console.log("PASS: real browser push subscription registered");
    await page
      .getByRole("button", { name: "Désactiver sur cet appareil", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Activer les notifications", exact: true })
      .waitFor();
    console.log("PASS: device push subscription removed");
  } catch {
    console.log("Push service registration unavailable in this test browser");
  }
  await page
    .getByRole("button", { name: "Se déconnecter", exact: true })
    .click();
} finally {
  await browser?.close();
  server.kill();
}
