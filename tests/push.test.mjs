import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { validSubscription } from "../supabase/functions/web-push/push-policy.ts";
test("push subscriptions reject local endpoints and malformed encryption keys", () => {
  const keys = { p256dh: "B" + "A".repeat(86), auth: "A".repeat(22) };
  for (const endpoint of [
    "http://fcm.googleapis.com/send/a",
    "https://127.0.0.1/private",
    "https://evil.example/push",
    "https://fcm.googleapis.com.evil.example/push",
    "https://user:pass@fcm.googleapis.com/a",
    "https://fcm.googleapis.com:8443/a",
  ])
    assert.equal(validSubscription({ endpoint, keys }), false);
  assert.equal(
    validSubscription({
      endpoint: "https://fcm.googleapis.com/send/test",
      keys,
    }),
    true,
  );
  assert.equal(
    validSubscription({
      endpoint: "https://fcm.googleapis.com/send/test",
      keys: {},
    }),
    false,
  );
});
test("service worker displays an alert and opens the account notification screen", async () => {
  const handlers = {},
    shown = [];
  let opened;
  const self = {
    addEventListener: (name, fn) => (handlers[name] = fn),
    registration: {
      scope: "https://suiviscolaire.info/",
      showNotification: async (...args) => shown.push(args),
    },
    clients: {
      matchAll: async () => [],
      openWindow: async (url) => {
        opened = url;
      },
    },
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), { self, URL });
  let completion;
  handlers.push({
    data: {
      json: () => ({
        title: "SuiviScolaire",
        body: "Sarah · Une nouvelle note est disponible.",
        tag: "mark-1",
      }),
    },
    waitUntil: (p) => (completion = p),
  });
  await completion;
  assert.equal(shown[0][1].body, "Sarah · Une nouvelle note est disponible.");
  handlers.notificationclick({
    notification: { close() {} },
    waitUntil: (p) => (completion = p),
  });
  await completion;
  assert.equal(opened, "https://suiviscolaire.info/#notifications");
});
