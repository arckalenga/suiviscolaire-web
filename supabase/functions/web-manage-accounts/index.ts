import { createClient } from "npm:@supabase/supabase-js@2.116.0";
const allowed = new Set([
  "https://arckalenga.github.io",
  "https://suiviscolaire.info",
  "https://www.suiviscolaire.info",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5176",
  "http://localhost:5173",
]);
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin":
      origin && allowed.has(origin) ? origin : "https://arckalenga.github.io",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (origin && !allowed.has(origin))
    return respond({ error: "Origine non autorisée." }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST")
    return respond({ error: "Méthode non autorisée." }, 405);
  const bearer = req.headers.get("authorization") || "";
  if (!bearer.startsWith("Bearer "))
    return respond({ error: "Connexion requise." }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const scoped = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false },
  });
  const { data: auth, error: authError } = await admin.auth.getUser(
    bearer.slice(7),
  );
  if (authError || !auth.user)
    return respond({ error: "Session expirée." }, 401);
  async function canManage(sid: string) {
    const { data, error } = await scoped.rpc("web_manage", { sid });
    return !error && data === true;
  }
  try {
    const text = await req.text();
    if (text.length > 12000)
      return respond({ error: "Requête trop volumineuse." }, 400);
    const b = JSON.parse(text);
    if (b.action === "archive_student") {
      if (typeof b.archived !== "boolean")
        return respond({ error: "Action invalide." }, 400);
      const { data: student } = await admin
        .from("web_students")
        .select("id,school_id")
        .eq("id", b.student_id)
        .maybeSingle();
      if (!student || !(await canManage(student.school_id)))
        return respond({ error: "Accès refusé." }, 403);
      const { error } = await admin.rpc("web_archive_student", {
        sid: student.id,
        is_archived: b.archived,
      });
      return error
        ? respond({ error: "Modification impossible." }, 400)
        : respond({ ok: true });
    }
    if (!["create_student", "create_subadmin"].includes(b.action))
      return respond({ error: "Action inconnue." }, 400);
    const role = b.action === "create_student" ? "student" : "subadmin";
    const schoolIds = Array.from(
      new Set(Array.isArray(b.school_ids) ? b.school_ids : []),
    ) as string[];
    if (
      !schoolIds.length ||
      schoolIds.length > 50 ||
      schoolIds.some(
        (s) => typeof s !== "string" || !/^[0-9a-f-]{36}$/i.test(s),
      )
    )
      return respond({ error: "Établissement requis." }, 400);
    if (role === "subadmin") {
      const { data, error } = await scoped.rpc("web_is_admin");
      if (error || !data)
        return respond({ error: "Administrateur principal requis." }, 403);
    } else if (schoolIds.length !== 1 || !(await canManage(schoolIds[0])))
      return respond({ error: "Accès refusé." }, 403);
    const name = String(b.name || "").trim(),
      email = String(b.email || "")
        .trim()
        .toLowerCase();
    if (
      name.length < 2 ||
      name.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254
    )
      return respond({ error: "Nom ou adresse e-mail invalide." }, 400);
    if (role === "student") {
      if (!String(b.matricule || "").trim() || String(b.matricule).length > 60)
        return respond(
          { error: "Matricule requis (60 caractères maximum)." },
          400,
        );
      const { data: cl } = await admin
        .from("web_classes")
        .select("id")
        .eq("school_id", schoolIds[0])
        .eq("name", b.class_name)
        .maybeSingle();
      if (!cl) return respond({ error: "Classe inexistante." }, 400);
      if (b.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(b.birth_date))
        return respond({ error: "Date attendue au format AAAA-MM-JJ." }, 400);
    }
    const password = Array.from(
      crypto.getRandomValues(new Uint8Array(18)),
      (x) => x.toString(16).padStart(2, "0"),
    ).join("");
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (createError || !created.user)
      return respond(
        {
          error:
            "Compte non créé. Vérifiez si cette adresse est déjà utilisée.",
        },
        400,
      );
    const { error } = await admin.rpc("web_provision_account", {
      uid: created.user.id,
      account_role: role,
      school_ids: schoolIds,
      profile: {
        name,
        email,
        class_name: b.class_name,
        matricule: String(b.matricule || "").trim(),
        sex: b.sex || "",
        birth_date: b.birth_date || "",
      },
    });
    if (error) {
      await admin.auth.admin.deleteUser(created.user.id);
      return respond(
        {
          error:
            "Profil non créé : vérifiez le matricule, la classe et les informations saisies.",
        },
        400,
      );
    }
    return respond({ ok: true, email, password, user_id: created.user.id });
  } catch {
    return respond(
      { error: "Requête invalide ou service momentanément indisponible." },
      400,
    );
  }
});
