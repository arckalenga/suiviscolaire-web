export type SheetRow = Record<string, string>;
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
export async function readWorkbook(file: File): Promise<SheetRow[]> {
  const XLSX = await import("xlsx");
  if (file.size > 2 * 1024 * 1024) throw Error("Le fichier dépasse 2 Mo.");
  if (!/\.(xlsx|xls|csv)$/i.test(file.name))
    throw Error("Choisissez un fichier Excel (.xlsx, .xls) ou CSV.");
  const book = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
    sheetRows: 502,
  });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) throw Error("Le classeur est vide.");
  if (Object.values(sheet).some((c: any) => c?.f))
    throw Error("Remplacez les formules par leurs valeurs avant l’import.");
  const raw = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  });
  if (raw.length < 2) throw Error("Aucune ligne à importer.");
  if (raw.length > 501)
    throw Error("Importez au maximum 500 lignes à la fois.");
  const headers = raw[0].map((x) => normalize(String(x)));
  if (new Set(headers).size !== headers.length)
    throw Error("Les en-têtes de colonnes sont dupliqués.");
  return raw
    .slice(1)
    .map((line) =>
      Object.fromEntries(
        headers.map((h, i) => [
          h,
          line[i] instanceof Date
            ? [
                line[i].getFullYear(),
                String(line[i].getMonth() + 1).padStart(2, "0"),
                String(line[i].getDate()).padStart(2, "0"),
              ].join("-")
            : String(line[i] ?? "").trim(),
        ]),
      ),
    );
}
export async function downloadWorkbook(
  name: string,
  rows: Record<string, any>[],
) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = Object.keys(rows[0] || {}).map(() => ({ wch: 26 }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Données");
  XLSX.writeFile(book, name);
}
export function validateStudents(
  rows: SheetRow[],
  classes: string[],
  existing: { matricule: string; email?: string }[],
) {
  const matricules = new Set(existing.map((s) => s.matricule.toLowerCase())),
    emails = new Set(
      existing.map((s) => s.email?.toLowerCase()).filter(Boolean),
    );
  return rows.map((r, i) => {
    const errors: string[] = [];
    if (!r.nom || r.nom.length < 2) errors.push("Nom requis");
    if (!r.matricule || r.matricule.length > 60)
      errors.push("Matricule requis (60 caractères maximum)");
    if (matricules.has(r.matricule?.toLowerCase()))
      errors.push("Matricule déjà utilisé");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email || ""))
      errors.push("Email invalide");
    if (emails.has(r.email?.toLowerCase())) errors.push("Email déjà utilisé");
    if (!classes.includes(r.classe)) errors.push("Classe inconnue");
    if (r.sexe && !["M", "F"].includes(r.sexe)) errors.push("Sexe : M ou F");
    if (
      r.naissance &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(r.naissance) ||
        Number.isNaN(Date.parse(r.naissance)) ||
        new Date(r.naissance).toISOString().slice(0, 10) !== r.naissance ||
        r.naissance > new Date().toISOString().slice(0, 10))
    )
      errors.push("Date invalide : AAAA-MM-JJ");
    matricules.add(r.matricule?.toLowerCase());
    emails.add(r.email?.toLowerCase());
    return { ...r, line: i + 2, errors };
  });
}
export function validateMarks(
  rows: SheetRow[],
  students: { id: string; matricule: string }[],
  maximum: number,
) {
  const seen = new Set<string>();
  return rows
    .filter((r) => r.note !== "" && r.note !== undefined)
    .map((r, i) => {
      const student = students.find(
        (s) => s.matricule.toLowerCase() === r.matricule?.toLowerCase(),
      );
      const score = Number((r.note || "").replace(",", ".")),
        errors: string[] = [];
      if (!student) errors.push("Matricule inconnu dans cette classe");
      if (seen.has(r.matricule?.toLowerCase()))
        errors.push("Matricule dupliqué");
      seen.add(r.matricule?.toLowerCase());
      if (!Number.isFinite(score) || score < 0 || score > maximum)
        errors.push("Note attendue entre 0 et " + maximum);
      return { ...r, line: i + 2, student_id: student?.id, score, errors };
    });
}
