import { useState } from "react";
import { db } from "./client";
type Row = Record<string, any>;
export function ReceiptActions({
  payment,
  school,
  student,
}: {
  payment: Row;
  school: Row;
  student: Row;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function receipt(mode: "download" | "print" | "share") {
    setBusy(true);
    setMessage("");
    try {
      const { data: p, error } = await db
        .from("web_payments")
        .select("*")
        .eq("id", payment.id)
        .single();
      if (error || !p) throw Error();
      const { makeReceipt } = await import("./receipt-pdf");
      const doc = makeReceipt(p, school, student),
        name = "recu-" + p.id + ".pdf";
      if (mode === "download") doc.save(name);
      else if (mode === "print") {
        doc.autoPrint();
        const url = doc.output("bloburl");
        const link = document.createElement("a");
        link.href = String(url);
        link.target = "_blank";
        link.rel = "noopener";
        link.click();
        setTimeout(() => URL.revokeObjectURL(String(url)), 60000);
      } else {
        const file = new File([doc.output("blob")], name, {
          type: "application/pdf",
        });
        if (navigator.canShare?.({ files: [file] }))
          await navigator.share({ files: [file], title: "Reçu de paiement" });
        else {
          doc.save(name);
          setMessage(
            "PDF téléchargé. Joignez-le à votre email ou message WhatsApp.",
          );
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setMessage(
          "Impossible de préparer le reçu. Vérifiez votre accès et réessayez.",
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="row-actions">
      <button disabled={busy} onClick={() => receipt("download")}>
        Reçu PDF
      </button>
      <button disabled={busy} onClick={() => receipt("print")}>
        Imprimer le reçu
      </button>
      <button disabled={busy} onClick={() => receipt("share")}>
        Partager · Email / WhatsApp
      </button>
      {message && (
        <small role="status">
          {message}{" "}
          <a
            href="mailto:?subject=Reçu%20de%20paiement"
            target="_blank"
            rel="noopener"
          >
            Ouvrir email
          </a>{" "}
          ·{" "}
          <a
            href="https://wa.me/?text=Veuillez%20trouver%20le%20reçu%20de%20paiement%20en%20pièce%20jointe."
            target="_blank"
            rel="noopener noreferrer"
          >
            Ouvrir WhatsApp
          </a>
        </small>
      )}
    </div>
  );
}
