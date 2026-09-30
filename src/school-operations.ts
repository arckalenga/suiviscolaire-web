export const attendanceLabels: Record<string, string> = {
  present: "Présent",
  absent: "Absent",
  late: "Retard",
  excused: "Absence justifiée",
};
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
export function validateAttendance(
  rows: Record<string, string>[],
  people: { id: string; name: string; matricule?: string }[],
  kind: "student" | "worker",
) {
  const seen = new Set<string>();
  return rows.map((raw, index) => {
    const code = normalize(
      raw[kind === "student" ? "matricule" : "identifiant"] || "",
    );
    const person = people.find(
      (p) =>
        normalize(kind === "student" ? p.matricule || "" : p.id) === code &&
        code !== "",
    );
    const input = normalize(raw.statut || "");
    const status =
      Object.keys(attendanceLabels).find(
        (k) => normalize(attendanceLabels[k]) === input || k === input,
      ) || "";
    const errors: string[] = [];
    if (!person) errors.push("Personne inconnue dans la sélection");
    if (!status)
      errors.push(
        "Statut requis : Présent, Absent, Retard ou Absence justifiée",
      );
    if (seen.has(code)) errors.push("Personne en double");
    seen.add(code);
    if ((raw.observation || "").length > 500)
      errors.push("Observation limitée à 500 caractères");
    return {
      line: index + 2,
      name: person?.name || code,
      person_id: person?.id || "",
      status,
      note: raw.observation || "",
      errors,
    };
  });
}
export function financeTotals(
  incoming: { amount: number | string; currency: string }[],
  outgoing: { amount: number | string; currency: string }[],
) {
  return ["CDF", "USD"].map((currency) => {
    const sum = (rows: typeof incoming) =>
      Math.round(
        rows
          .filter((p) => p.currency === currency)
          .reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0),
      ) / 100;
    const received = sum(incoming),
      paid = sum(outgoing);
    return {
      currency,
      received,
      paid,
      net: Math.round((received - paid) * 100) / 100,
    };
  });
}
