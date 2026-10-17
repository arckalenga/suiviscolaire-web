export function schoolLogoPath(school: Record<string, any>): string | null {
  return school.logo_key === "itc-kolwezi"
    ? "./school-logos/itc-kolwezi.png"
    : null;
}
const cache = new Map<string, Promise<string>>();
export async function logoData(source: string): Promise<string> {
  let pending = cache.get(source);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(source, {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw Error("Logo de l’école indisponible.");
      const blob = await response.blob();
      if (!blob.type.startsWith("image/png") || blob.size > 3000000)
        throw Error("Logo invalide.");
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(Error("Lecture du logo impossible."));
        reader.readAsDataURL(blob);
      });
    })();
    cache.set(source, pending);
    pending.catch(() => cache.delete(source));
  }
  return pending;
}
