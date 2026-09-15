import test from "node:test";
import assert from "node:assert/strict";
import { invokeAuthenticated } from "../src/auth-invoke.ts";
const session = (token = "old") => ({
  access_token: token,
  expires_at: Date.now() / 1000 + 3600,
  user: { id: "user" },
});
function fake(statuses = [200], refreshError = false) {
  const calls = [];
  let refreshes = 0;
  return {
    calls,
    get refreshes() {
      return refreshes;
    },
    auth: {
      getSession: async () => ({ data: { session: session() }, error: null }),
      refreshSession: async () => {
        refreshes++;
        return {
          data: { session: refreshError ? null : session("fresh") },
          error: refreshError ? Error() : null,
        };
      },
    },
    functions: {
      invoke: async (name, options) => {
        calls.push(options);
        const status = statuses.shift() || 200;
        return {
          data: status === 200 ? { ok: true } : null,
          error: status === 200 ? null : { context: { status } },
        };
      },
    },
  };
}
test("401 refreshes and retries once with explicit fresh bearer", async () => {
  const c = fake([401, 200]);
  assert.deepEqual(
    (await invokeAuthenticated(c, "accounts", { action: "create_parent" }))
      .data,
    { ok: true },
  );
  assert.equal(c.refreshes, 1);
  assert.equal(c.calls[0].headers.Authorization, "Bearer old");
  assert.equal(c.calls[1].headers.Authorization, "Bearer fresh");
});
test("network/server errors are not retried to avoid duplicate creation", async () => {
  const c = fake([500]);
  await invokeAuthenticated(c, "accounts", {});
  assert.equal(c.calls.length, 1);
  assert.equal(c.refreshes, 0);
});
test("revoked refresh requires login and never resubmits", async () => {
  const c = fake([401], true);
  await assert.rejects(invokeAuthenticated(c, "accounts", {}), /reconnectez/);
  assert.equal(c.calls.length, 1);
});
test("second 401 stops after one retry", async () => {
  const c = fake([401, 401]);
  await assert.rejects(
    invokeAuthenticated(c, "accounts", {}),
    /Session expirée/,
  );
  assert.equal(c.calls.length, 2);
});
