import type { SupabaseClient } from "@supabase/supabase-js";
const expired = () =>
  new Error(
    "Session expirée. Déconnectez-vous puis reconnectez-vous avant de réessayer.",
  );
export async function invokeAuthenticated(
  client: Pick<SupabaseClient, "auth" | "functions">,
  name: string,
  body: Record<string, unknown>,
) {
  const current = await client.auth.getSession();
  let session = current.data.session;
  if (current.error || !session) throw expired();
  const userId = session.user.id;
  async function refresh() {
    const result = await client.auth.refreshSession();
    if (
      result.error ||
      !result.data.session ||
      result.data.session.user.id !== userId
    )
      throw expired();
    return result.data.session;
  }
  let refreshed = false;
  if (!session.expires_at || session.expires_at * 1000 - Date.now() < 60000) {
    session = await refresh();
    refreshed = true;
  }
  const send = () =>
    client.functions.invoke(name, {
      body,
      headers: { Authorization: "Bearer " + session!.access_token },
    });
  let result = await send();
  if (result.error?.context?.status === 401 && !refreshed) {
    session = await refresh();
    result = await send();
  }
  if (result.error?.context?.status === 401) throw expired();
  return result;
}
