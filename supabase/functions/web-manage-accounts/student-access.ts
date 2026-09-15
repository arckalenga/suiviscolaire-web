export function slug(value: string, limit = 48): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, limit)
    .replace(/-+$/g, "");
}
export function studentEmail(name: string, domain: string): string {
  const local = slug(name, 48).replace(/-/g, ".") || "eleve";
  return local + "@" + domain.toLowerCase();
}
export function studentPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (n) => alphabet[n & 31],
  ).join("");
}
