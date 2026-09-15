import { jsPDF } from "jspdf";
import { autoTable, type CellInput } from "jspdf-autotable";

const clean = (value: string) =>
  value.replace(/[’‘]/g, "'").replace(/[—–]/g, "-").replace(/\s+/g, " ").trim();
export function buildBulletinPdf(element: HTMLElement, filename: string) {
  const table = element.querySelector<HTMLTableElement>(".report-table");
  if (!table) throw Error("Bulletin indisponible.");
  const columns = Array.from(table.rows[0].cells).reduce(
    (sum, cell) => sum + cell.colSpan,
    0,
  );
  const doc = new jsPDF({
    orientation: columns > 24 ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });
  const width = doc.internal.pageSize.getWidth(),
    height = doc.internal.pageSize.getHeight();
  const margin = 7,
    contentWidth = width - 2 * margin;
  doc.setProperties({
    title: filename.replace(/\.pdf$/, ""),
    author: "SuiviScolaire",
    subject: "Bulletin scolaire",
  });
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(22, 42, 68);
  doc.text("RÉPUBLIQUE DÉMOCRATIQUE DU CONGO", width / 2, 15, {
    align: "center",
  });
  doc.setFontSize(8);
  doc.text(
    "MINISTÈRE DE L'ÉDUCATION NATIONALE ET NOUVELLE CITOYENNETÉ",
    width / 2,
    21,
    { align: "center" },
  );
  doc.setFontSize(9);
  doc.text("BULLETIN SCOLAIRE", width / 2, 28, {
    align: "center",
  });
  doc
    .setDrawColor(35, 89, 216)
    .setLineWidth(0.5)
    .line(margin, 33, width - margin, 33);
  let y = 39;
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(25);
  const identities = Array.from(
    element.querySelectorAll(".bulletin-identity > div"),
  );
  const identityBottoms = identities.map((part, i) => {
    let yy = y;
    for (const line of part.querySelectorAll("p")) {
      const lines = doc.splitTextToSize(
        clean(line.textContent || ""),
        contentWidth / 2 - 5,
      );
      doc.text(lines, margin + (i * contentWidth) / 2, yy);
      yy += lines.length * 4 + 1;
    }
    return yy;
  });
  y = Math.max(y, ...identityBottoms) + 3;
  const cellText = (cell: HTMLTableCellElement) => {
    const max = cell.querySelector("small");
    if (!max) return clean(cell.textContent || "").replace(/^EXAMEN$/, "EX.");
    const copy = cell.cloneNode(true) as HTMLElement;
    copy.querySelector("small")?.remove();
    return clean(copy.textContent || "") + "\n" + clean(max.textContent || "");
  };
  const rows = (section: HTMLTableSectionElement | null): CellInput[][] =>
    Array.from(section?.rows || []).map((row) =>
      Array.from(row.cells).map((cell) => ({
        content: cellText(cell),
        colSpan: cell.colSpan,
        rowSpan: cell.rowSpan,
        styles:
          row.classList.contains("domain") ||
          row.classList.contains("subtotal") ||
          row.classList.contains("branch-group") ||
          row.classList.contains("maxima") ||
          row.classList.contains("totals")
            ? {
                fillColor: [234, 239, 246] as [number, number, number],
                fontStyle: "bold" as const,
                halign:
                  cell.colSpan > 1 ? ("left" as const) : ("center" as const),
              }
            : {},
      })),
    );
  autoTable(doc, {
    head: rows(table.tHead),
    body: rows(table.tBodies[0]),
    startY: y,
    margin: { top: 15, right: margin, bottom: 15, left: margin },
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: columns > 24 ? 6 : 5.5,
      cellPadding: 0.45,
      textColor: 25,
      lineColor: [168, 179, 192],
      lineWidth: 0.15,
      halign: "center",
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: { fillColor: [30, 57, 94], textColor: 255, fontSize: 5.5 },
    columnStyles: { 0: { cellWidth: contentWidth * 0.23, halign: "left" } },
  });
  y =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 7;
  if (y + 35 > height - 15) {
    doc.addPage();
    y = 18;
  }
  doc.setTextColor(20).setFont("helvetica", "normal").setFontSize(7);
  doc.rect(margin, y - 2, 2, 2);
  doc.text("L'élève passe dans la classe supérieure.", margin + 4, y);
  doc.rect(margin, y + 3, 2, 2);
  doc.text("L'élève double la classe.", margin + 4, y + 5);
  doc.text(
    "Fait à .............................. le ...... / ...... / ............",
    width - margin,
    y,
    { align: "right" },
  );
  y += 24;
  ["Signature de l'élève", "Sceau de l'école", "Chef d'établissement"].forEach(
    (label, i) => {
      const x = margin + (contentWidth * (i + 0.5)) / 3;
      doc.setDrawColor(150).line(x - 19, y, x + 19, y);
      doc
        .setFont("helvetica", "bold")
        .text(label, x, y + 4, { align: "center" });
      if (i === 2)
        doc
          .setFont("helvetica", "normal")
          .text("Nom et signature", x, y + 8, { align: "center" });
    },
  );
  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page++) {
    doc.setPage(page).setFontSize(7).setTextColor(100);
    doc.text(
      "SuiviScolaire | " + page + " / " + count,
      width - margin,
      height - 7,
      { align: "right" },
    );
  }
  return doc;
}
export async function downloadBulletinPdf(
  element: HTMLElement,
  filename: string,
) {
  const doc = buildBulletinPdf(element, filename);
  await doc.save(filename, { returnPromise: true });
}
