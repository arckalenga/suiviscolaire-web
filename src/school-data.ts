import { db } from "./client";
export async function schoolRows(
  table: string,
  schoolId: string,
  filters: Record<string, string> = {},
): Promise<Record<string, any>[]> {
  const rows: Record<string, any>[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = db
      .from(table)
      .select("*")
      .eq("school_id", schoolId)
      .order("id")
      .range(offset, offset + 999);
    for (const [key, value] of Object.entries(filters))
      query = query.eq(key, value);
    const result = await query;
    if (result.error)
      throw Error(
        "Chargement impossible. Vérifiez votre connexion et vos droits.",
      );
    rows.push(...(result.data || []));
    if ((result.data?.length || 0) < 1000) return rows;
  }
}
