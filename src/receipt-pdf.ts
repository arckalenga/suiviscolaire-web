import { jsPDF } from "jspdf";
export function makeReceipt(
  p: Record<string, any>,
  school: Record<string, any>,
  student: Record<string, any>,
) {
  const doc = new jsPDF();
  doc.setTextColor(25, 55, 99);
  doc.setFontSize(21);
  doc.text("REÇU DE PAIEMENT", 20, 25);
  doc.setFontSize(13);
  doc.text(doc.splitTextToSize(school.name, 170), 20, 39);
  doc.setTextColor(35);
  const rows = [
    ["Élève", student.name],
    ["Classe", student.class_name],
    ["Date du paiement", p.paid_on],
    ["Objet", p.label],
    ["Montant reçu", Number(p.amount).toFixed(2) + " " + p.currency],
    ["Référence", p.reference],
    ["Identifiant du reçu", p.id],
  ];
  let y = 60;
  doc.setFontSize(11);
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "bold");
    doc.text(label, 20, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(String(value || "—"), 110);
    doc.text(lines, 78, y);
    y += Math.max(13, lines.length * 6 + 6);
  }
  doc.line(20, y + 4, 190, y + 4);
  doc.text("Paiement reçu et enregistré par l’établissement.", 20, y + 17);
  doc.text("Signature et cachet de l’école :", 20, y + 37);
  return doc;
}
