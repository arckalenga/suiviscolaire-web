import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import webpush from "npm:web-push@3.6.7";
const origins = new Set([
  "https://suiviscolaire.info",
  "https://www.suiviscolaire.info",
  "https://arckalenga.github.io",
  "http://127.0.0.1:5176",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);
import { validSubscription } from "./push-policy.ts";
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin":
      origin && origins.has(origin) ? origin : "https://suiviscolaire.info",
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const reply = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });
  if (origin && !origins.has(origin))
    return reply({ error: "Origine refusée." }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "POST requis." }, 405);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  try {
    const raw = await req.text();
    if (raw.length > 6000)
      return reply({ error: "Requête trop volumineuse." }, 400);
    const b = JSON.parse(raw);
    let { data: config } = await admin
      .from("web_push_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (b.action === "deliver") {
      if (!config || !b.worker_token || b.worker_token !== config.worker_token)
        return reply({ error: "Accès refusé." }, 403);
      const { data: jobs, error } = await admin.rpc("web_claim_push_jobs");
      if (error) throw error;
      let sent = 0;
      await Promise.all(
        (jobs || []).map(async (job) => {
          const [{ data: sub }, { data: student }, { data: assignment }] =
            await Promise.all([
              admin
                .from("web_push_subscriptions")
                .select("*")
                .eq("id", job.subscription_id)
                .maybeSingle(),
              admin
                .from("web_students")
                .select("id,user_id,name,school_id,archived")
                .eq("id", job.student_id)
                .maybeSingle(),
              admin
                .from("web_assignments")
                .select("published,published_at")
                .eq("id", job.assignment_id)
                .maybeSingle(),
            ]);
          let permitted = false;
          if (
            sub &&
            student &&
            !student.archived &&
            assignment?.published &&
            new Date(assignment.published_at).getTime() ===
              new Date(job.published_at).getTime()
          ) {
            if (sub.user_id === student.user_id) {
              const { data: m } = await admin
                .from("web_memberships")
                .select("active")
                .eq("user_id", sub.user_id)
                .eq("school_id", student.school_id)
                .eq("role", "student")
                .maybeSingle();
              permitted = !!m?.active;
            }
            if (!permitted) {
              const { data: g } = await admin
                .from("web_guardians")
                .select("active")
                .eq("parent_id", sub.user_id)
                .eq("student_id", student.id)
                .maybeSingle();
              permitted = !!g?.active;
            }
          }
          if (!permitted || !validSubscription(sub)) {
            await admin
              .from("web_push_jobs")
              .update({ done: true })
              .eq("id", job.id);
            return;
          }
          try {
            const payload = JSON.stringify({
              title: "SuiviScolaire",
              body: student.name + " · Une nouvelle note est disponible.",
              tag: "mark-" + job.assignment_id + "-" + student.id,
            });
            const request = webpush.generateRequestDetails(
              { endpoint: sub.endpoint, keys: sub.keys },
              payload,
              {
                TTL: 3600,
                vapidDetails: {
                  subject: "mailto:contact@suiviscolaire.info",
                  publicKey: config.public_key,
                  privateKey: config.private_key,
                },
              },
            );
            const response = await fetch(request.endpoint, {
              method: request.method,
              headers: request.headers,
              body: request.body,
              redirect: "error",
              signal: AbortSignal.timeout(6000),
            });
            await response.body?.cancel();
            if (response.status === 404 || response.status === 410) {
              await admin
                .from("web_push_subscriptions")
                .delete()
                .eq("id", sub.id);
            } else if (response.ok) {
              await admin
                .from("web_push_jobs")
                .update({ done: true })
                .eq("id", job.id);
              sent++;
            } else
              await admin
                .from("web_push_jobs")
                .update({
                  available_at: new Date(Date.now() + 300000).toISOString(),
                })
                .eq("id", job.id);
          } catch {
            await admin
              .from("web_push_jobs")
              .update({
                available_at: new Date(Date.now() + 300000).toISOString(),
              })
              .eq("id", job.id);
          }
        }),
      );
      return reply({ ok: true, processed: jobs?.length || 0, sent });
    }
    const token = (req.headers.get("authorization") || "").replace(
      /^Bearer /,
      "",
    );
    const { data: user, error: authError } = await admin.auth.getUser(token);
    if (authError || !user.user)
      return reply({ error: "Connexion requise." }, 401);
    const uid = user.user.id;
    if (b.action === "setup") {
      const { data: a } = await admin
        .from("web_admins")
        .select("user_id")
        .eq("user_id", uid)
        .maybeSingle();
      if (!a) return reply({ error: "Accès refusé." }, 403);
      if (!config) {
        const keys = webpush.generateVAPIDKeys();
        const { error } = await admin
          .from("web_push_config")
          .insert({
            id: 1,
            public_key: keys.publicKey,
            private_key: keys.privateKey,
            worker_token: crypto.randomUUID() + crypto.randomUUID(),
          });
        if (error) throw error;
      }
      return reply({ ok: true });
    }
    if (b.action === "key")
      return config
        ? reply({ publicKey: config.public_key })
        : reply({ error: "Notifications non configurées." }, 503);
    if (b.action === "subscribe") {
      if (!validSubscription(b.subscription))
        return reply({ error: "Abonnement invalide." }, 400);
      const scoped = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        {
          global: { headers: { Authorization: "Bearer " + token } },
          auth: { persistSession: false },
        },
      );
      const { data: children, error } = await scoped
        .from("web_students")
        .select("id")
        .limit(1);
      if (error || !children?.length)
        return reply({ error: "Aucun accès actif." }, 403);
      const { error: save } = await admin
        .from("web_push_subscriptions")
        .upsert(
          {
            user_id: uid,
            endpoint: b.subscription.endpoint,
            keys: b.subscription.keys,
          },
          { onConflict: "endpoint" },
        );
      if (save) throw save;
      return reply({ ok: true });
    }
    if (b.action === "unsubscribe") {
      const { error } = await admin
        .from("web_push_subscriptions")
        .delete()
        .eq("user_id", uid)
        .eq("endpoint", String(b.endpoint || ""));
      if (error) throw error;
      return reply({ ok: true });
    }
    return reply({ error: "Action inconnue." }, 400);
  } catch {
    return reply({ error: "Service momentanément indisponible." }, 500);
  }
});
