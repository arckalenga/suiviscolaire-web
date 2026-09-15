export function validSubscription(s: any) {
  try {
    const u = new URL(s.endpoint);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.hash &&
      s.endpoint.length < 2048 &&
      (u.hostname === "fcm.googleapis.com" ||
        u.hostname === "web.push.apple.com" ||
        u.hostname.endsWith(".push.apple.com") ||
        u.hostname === "updates.push.services.mozilla.com" ||
        u.hostname.endsWith(".push.services.mozilla.com") ||
        u.hostname.endsWith(".notify.windows.com")) &&
      /^[A-Za-z0-9_-]{87}$/.test(s.keys?.p256dh) &&
      /^[A-Za-z0-9_-]{22}$/.test(s.keys?.auth)
    );
  } catch {
    return false;
  }
}
