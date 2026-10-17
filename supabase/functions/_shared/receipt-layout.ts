// Shared layout keeps downloaded and emailed receipts identical.
export function drawReceipt(
  doc: any,
  p: Record<string, any>,
  school: Record<string, any>,
  person: Record<string, any>,
  logo?: string | Uint8Array,
) {
  const navy = [24, 55, 99],
    teal = [16, 115, 119],
    ink = [31, 48, 67];
  const clean = (v: any) => String(v || "-").replace(/[—–]/g, "-");
  const text = (
    s: any,
    x: number,
    y: number,
    size = 10,
    bold = false,
    color = ink,
  ) => {
    doc
      .setFont("helvetica", bold ? "bold" : "normal")
      .setFontSize(size)
      .setTextColor(...color);
    doc.text(clean(s), x, y);
  };
  doc.setProperties({
    title: "Reçu de paiement - " + school.name,
    author: "SuiviScolaire",
  });
  doc.setFillColor(...navy).rect(0, 0, 210, 8, "F");
  if (logo) doc.addImage(logo, "PNG", 88, 14, 34, 34);
  else {
    doc.setFontSize(19).setTextColor(...navy);
    doc.text("SuiviScolaire", 105, 34, { align: "center" });
  }
  doc
    .setFont("helvetica", "bold")
    .setFontSize(16)
    .setTextColor(...navy);
  doc.text(doc.splitTextToSize(clean(school.name), 176), 105, 56, {
    align: "center",
  });
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(
    doc.splitTextToSize(clean(school.full_name || school.city), 176),
    105,
    65,
    { align: "center" },
  );
  doc.setFillColor(...navy).roundedRect(16, 77, 178, 23, 3, 3, "F");
  text(
    p.worker_id ? "REÇU DE PAIEMENT DU PERSONNEL" : "REÇU DE PAIEMENT",
    23,
    88,
    13,
    true,
    [255, 255, 255],
  );
  text("Versement enregistré", 23, 95, 8, false, [200, 220, 244]);
  let y = 109;
  const box = (
    label: string,
    value: any,
    x: number,
    top: number,
    w: number,
    h: number,
  ) => {
    doc
      .setFillColor(242, 247, 251)
      .setDrawColor(212, 224, 235)
      .roundedRect(x, top, w, h, 2, 2, "FD");
    text(label.toUpperCase(), x + 5, top + 7, 7, true, teal);
    doc
      .setFont("helvetica", "bold")
      .setFontSize(10)
      .setTextColor(...ink);
    doc.text(doc.splitTextToSize(clean(value), w - 10), x + 5, top + 15);
  };
  const nameLines = doc
    .setFontSize(10)
    .splitTextToSize(clean(person.name), 105).length;
  const rowH = Math.max(26, 19 + nameLines * 4);
  box(
    p.worker_id ? "Bénéficiaire" : "Nom de l'élève",
    person.name,
    16,
    y,
    116,
    rowH,
  );
  box(
    p.worker_id ? "Fonction" : "Classe",
    person.class_name ||
      (person.kind === "teacher"
        ? "Enseignant"
        : person.kind === "worker"
          ? "Travailleur"
          : person.role || person.job_title),
    137,
    y,
    57,
    rowH,
  );
  y += rowH + 5;
  box("Date du paiement", p.paid_on, 16, y, 57, 26);
  box("Référence du paiement", p.reference || p.id, 78, y, 116, 26);
  y += 31;
  const labelLines = doc
    .setFontSize(10)
    .splitTextToSize(clean(p.label), 168).length;
  const objectH = Math.max(26, 19 + labelLines * 4);
  box("Objet du paiement", p.label, 16, y, 178, objectH);
  y += objectH + 7;
  doc.setFillColor(...teal).roundedRect(16, y, 178, 27, 3, 3, "F");
  text("MONTANT REÇU", 23, y + 9, 8, true, [218, 247, 241]);
  text(
    Number(p.amount).toFixed(2) + " " + clean(p.currency),
    23,
    y + 21,
    21,
    true,
    [255, 255, 255],
  );
  y += 36;
  text("Identifiant du reçu", 16, y, 7, true, teal);
  text(p.id, 16, y + 6, 8);
  text("Paiement reçu et enregistré par l'établissement.", 16, y + 16, 9);
  doc
    .setDrawColor(190, 207, 218)
    .line(16, y + 38, 91, y + 38)
    .line(119, y + 38, 194, y + 38);
  text("Signature du caissier", 16, y + 44, 8, false);
  text("Cachet de l'établissement", 119, y + 44, 8, false);
  doc.setFillColor(...navy).rect(0, 289, 210, 8, "F");
  text(
    "SuiviScolaire  |  Conservez ce reçu comme preuve de paiement.",
    16,
    294,
    7,
    false,
    [255, 255, 255],
  );
  return doc;
}
