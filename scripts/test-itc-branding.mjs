import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import { readFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const accounts = JSON.parse(
    readFileSync(".local/itc-kolwezi-accounts.json", "utf8"),
  ),
  admin = JSON.parse(readFileSync(".local/accounts.json", "utf8"))[0];
const env = loadEnv("development", process.cwd(), "");
mkdirSync(".local/itc-checks", { recursive: true });
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
  const selected = [
    admin,
    ...accounts.filter((a) => a.role !== "student"),
    accounts.find((a) => a.role === "student"),
  ];
  for (const [i, a] of selected.entries()) {
    const client = createClient(
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false } },
    );
    try {
      assert.equal(
        (
          await client.auth.signInWithPassword({
            email: a.email,
            password: a.password,
          })
        ).error,
        null,
      );
      const schools = await client.from("web_schools").select("id");
      assert.equal(schools.error, null);
      if (a !== admin)
        assert.deepEqual(
          schools.data.map((s) => s.id),
          [a.school_id],
        );
      if (a.role === "student") assert.equal(a.password.length, 6);
    } finally {
      await client.auth.signOut({ scope: "local" });
    }
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        acceptDownloads: true,
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(40000);
    await page.goto("http://127.0.0.1:5176/#connexion");
    await page.getByLabel("Adresse e-mail").fill(a.email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(a.password);
    await page
      .getByRole("button", { name: "Se connecter", exact: true })
      .click();
    await page.locator(".app").waitFor();
    if (a.role !== "student")
      await page
        .locator(".school-card")
        .filter({ hasText: "I.T.C KOLWEZI" })
        .first()
        .click();
    if (a.role === "student") {
      await page.locator(".learner-intro").waitFor();
      await page.screenshot({
        path: ".local/itc-checks/student-desktop.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: ".local/itc-checks/student-mobile.png",
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Bulletins", exact: true })
      .click();
    await page.locator(".bulletin .national-emblem").waitFor();
    assert.equal(await page.locator(".bulletin .school-logo").count(), 0);
    assert.equal(
      await page.locator(".national-emblem").evaluate(async (img) => {
        await img.decode();
        return img.naturalWidth > 0;
      }),
      true,
    );
    assert.ok(
      (await page.locator(".bulletin-identity").innerText()).includes(
        "Institut technique du cinquantenaire de Kolwezi",
      ),
    );
    let dl = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Télécharger le PDF", exact: true })
      .click();
    await (await dl).saveAs(".local/itc-checks/bulletin-" + i + ".pdf");
    if (i === 1)
      await page
        .locator(".bulletin")
        .screenshot({ path: ".local/itc-checks/bulletin-browser.png" });
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Paiements", exact: true })
      .click();
    dl = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Reçu PDF", exact: true })
      .first()
      .click();
    await (await dl).saveAs(".local/itc-checks/receipt-" + i + ".pdf");
    assert.deepEqual(errors, []);
    await page
      .getByRole("button", { name: "Se déconnecter", exact: true })
      .click();
    await context.close();
    console.log(
      "PASS ITC branded bulletin/receipt and school scope:",
      a.role || "mainadmin",
      i,
    );
  }
} finally {
  await browser?.close();
  server.kill();
}
