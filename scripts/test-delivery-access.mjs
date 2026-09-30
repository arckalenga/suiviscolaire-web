import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
const env = loadEnv("development", process.cwd(), "");
const accounts = JSON.parse(readFileSync(".local/accounts.json", "utf8")),
  staff = JSON.parse(
    readFileSync(".local/finance-management-credentials.json", "utf8"),
  );
const school = staff[0].school_id;
for (const account of [...staff, accounts[0], accounts[2], accounts[3]]) {
  const db = createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  try {
    const { error } = await db.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    assert.equal(error, null, "Login");
    const { data: members, error: me } = await db
      .from("web_memberships")
      .select("*");
    assert.equal(me, null);
    if (account.school_id) {
      const { data: schools, error: se } = await db
        .from("web_schools")
        .select("id");
      assert.equal(se, null);
      assert.deepEqual(
        schools.map((s) => s.id),
        [account.school_id],
      );
    }
    const sid = account.school_id || school;
    const status = await db.functions.invoke("web-delivery", {
      body: { action: "status", school_id: sid },
    });
    if (account === accounts[3]) {
      assert.equal(status.error?.context.status, 403);
    } else {
      assert.equal(status.error, null);
      assert.equal(status.data.email, false);
      assert.equal(status.data.whatsapp, false);
      const r = await db.functions.invoke("web-delivery", {
        body: {
          action: "send",
          school_id: sid,
          kind: "payment",
          channel: "email",
          event_id: "00000000-0000-0000-0000-000000000000",
          contact_id: "00000000-0000-0000-0000-000000000000",
        },
      });
      assert.equal(
        r.error?.context.status,
        account.role === "gestionnaire" || account === accounts[2] ? 403 : 503,
      );
    }
    console.log(
      "PASS API:",
      account.role || "existing role",
      "school scope / delivery disabled",
    );
  } finally {
    await db.auth.signOut({ scope: "local" });
  }
}
