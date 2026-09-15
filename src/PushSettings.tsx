import { useEffect, useState } from "react";
import { db } from "./client";
const ownerKey = "suiviscolaire-push-owner";
export async function stopPush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration(
    import.meta.env.BASE_URL,
  );
  const sub = await registration?.pushManager.getSubscription();
  try {
    if (sub)
      await db.functions.invoke("web-push", {
        body: { action: "unsubscribe", endpoint: sub.endpoint },
      });
  } finally {
    if (sub) await sub.unsubscribe();
    localStorage.removeItem(ownerKey);
  }
}
export function PushSettings({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const supported =
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  useEffect(() => {
    let alive = true;
    async function check() {
      if (!supported) return;
      const r = await navigator.serviceWorker.getRegistration(
        import.meta.env.BASE_URL,
      );
      const s = await r?.pushManager.getSubscription();
      if (s && localStorage.getItem(ownerKey) !== userId) {
        await stopPush();
        return;
      }
      if (alive) setEnabled(!!s);
    }
    void check().catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, supported]);
  return (
    <section className="panel no-print">
      <h3>Notifications sur cet appareil</h3>
      <p>
        Recevez une alerte lorsqu’une note est publiée. Les points restent dans
        votre compte. Un compte parent reçoit les alertes de tous ses enfants
        associés.
      </p>
      {!supported ? (
        <p>
          Les notifications nécessitent HTTPS et un navigateur compatible. Sur
          iPhone/iPad, ajoutez d’abord le site à l’écran d’accueil.
        </p>
      ) : (
        <button
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            try {
              if (enabled) {
                await stopPush();
                setEnabled(false);
                return;
              }
              if ((await Notification.requestPermission()) !== "granted") {
                setMessage(
                  "Autorisez les notifications dans les paramètres du navigateur pour les activer.",
                );
                return;
              }
              const { data, error } = await db.functions.invoke("web-push", {
                body: { action: "key" },
              });
              if (error || !data?.publicKey) throw Error();
              const r = await navigator.serviceWorker.register(
                import.meta.env.BASE_URL + "sw.js",
                { scope: import.meta.env.BASE_URL },
              );
              await navigator.serviceWorker.ready;
              const sub = await r.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: data.publicKey,
              });
              const saved = await db.functions.invoke("web-push", {
                body: { action: "subscribe", subscription: sub.toJSON() },
              });
              if (saved.error) {
                await sub.unsubscribe();
                throw Error();
              }
              localStorage.setItem(ownerKey, userId);
              setEnabled(true);
              setMessage("Notifications activées sur cet appareil.");
            } catch {
              setMessage(
                "Activation impossible pour le moment. Réessayez depuis la version HTTPS du site.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {enabled
            ? "Désactiver sur cet appareil"
            : "Activer les notifications"}
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
