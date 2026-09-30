import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { jsPDF } from "npm:jspdf@4.2.1";
import {
  eligibleRecipient,
  deliveryText,
  type DeliveryKind,
} from "./delivery-policy.ts";
const origins = new Set([
  "https://suiviscolaire.info",
  "https://www.suiviscolaire.info",
  "https://arckalenga.github.io",
  "http://127.0.0.1:5176",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);
const env = (key: string) => Deno.env.get(key) || "";
function configured(channel: string) {
  if (env("DELIVERY_ENABLED") !== "true") return false;
  return channel === "email"
    ? !!(env("RESEND_API_KEY") && env("DELIVERY_FROM_EMAIL"))
    : !!(
        env("WHATSAPP_ACCESS_TOKEN") &&
        env("WHATSAPP_PHONE_NUMBER_ID") &&
        env("WHATSAPP_TEMPLATE_NAME") &&
        env("WHATSAPP_TEMPLATE_LANGUAGE") &&
        /^v\d+\.\d+$/.test(env("WHATSAPP_GRAPH_VERSION"))
      );
}
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin":
      origin && origins.has(origin) ? origin : "https://suiviscolaire.info",
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    Vary: "Origin",
  };
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (origin && !origins.has(origin))
    return reply({ error: "Origine refusée." }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "POST requis." }, 405);
  const bearer = req.headers.get("authorization") || "";
  if (!bearer.startsWith("Bearer "))
    return reply({ error: "Connexion requise." }, 401);
  const admin = createClient(
    env("SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
  const scoped = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false },
  });
  const { data: auth, error: authError } = await admin.auth.getUser(
    bearer.slice(7),
  );
  if (authError || !auth.user) return reply({ error: "Session expirée." }, 401);
  try {
    const raw = await req.text();
    if (raw.length > 3000)
      return reply({ error: "Requête trop volumineuse." }, 400);
    const b = JSON.parse(raw);
    const { data: staff, error: se } = await scoped.rpc("web_school_staff", {
      sid: b.school_id,
    });
    if (se || !staff) return reply({ error: "Accès refusé." }, 403);
    if (b.action === "status")
      return reply({
        email: configured("email"),
        whatsapp: configured("whatsapp"),
      });
    const tables: Record<string, string> = {
      payment: "web_payments",
      staff_payment: "web_staff_payments",
      mark: "web_assignments",
      message: "web_messages",
    };
    if (
      b.action !== "send" ||
      !tables[b.kind] ||
      !["email", "whatsapp"].includes(b.channel)
    )
      return reply({ error: "Envoi invalide." }, 400);
    const { data: permission, error: pe } = await scoped.rpc(
      ["payment", "staff_payment"].includes(b.kind)
        ? "web_finance"
        : "web_manage",
      { sid: b.school_id },
    );
    if (pe || !permission)
      return reply(
        { error: "Ce rôle ne peut pas envoyer cette notification." },
        403,
      );
    if (!configured(b.channel))
      return reply(
        { error: "Service d’envoi non configuré. Aucun message envoyé." },
        503,
      );
    const { data: contact } = await scoped
      .from("web_delivery_contacts")
      .select("*")
      .eq("id", b.contact_id)
      .eq("school_id", b.school_id)
      .single();
    const { data: event } = await scoped
      .from(tables[b.kind])
      .select("*")
      .eq("id", b.event_id)
      .eq("school_id", b.school_id)
      .single();
    if (!contact || !event)
      return reply({ error: "Destinataire ou document introuvable." }, 404);
    if (
      (b.channel === "email" && (!contact.email_consent || !contact.email)) ||
      (b.channel === "whatsapp" &&
        (!contact.whatsapp_consent || !contact.phone))
    )
      return reply(
        { error: "Coordonnées ou accord du destinataire manquants." },
        400,
      );
    let person: any = null,
      hasMark = false;
    if (contact.student_id) {
      const r = await scoped
        .from("web_students")
        .select("*")
        .eq("id", contact.student_id)
        .single();
      person = r.data;
      if (b.kind === "mark") {
        const r = await scoped
          .from("web_marks")
          .select("id")
          .eq("assignment_id", event.id)
          .eq("student_id", contact.student_id)
          .maybeSingle();
        hasMark = !!r.data && !r.error;
      }
    } else {
      const r = await scoped
        .from("web_workers")
        .select("*")
        .eq("id", contact.worker_id)
        .eq("active", true)
        .single();
      person = r.data;
    }
    if (
      !person ||
      !eligibleRecipient(
        b.kind,
        event,
        contact,
        contact.student_id ? person : null,
        hasMark,
      )
    )
      return reply(
        { error: "Ce document ne concerne pas ce destinataire." },
        403,
      );
    const { data: school } = await scoped
      .from("web_schools")
      .select("name")
      .eq("id", b.school_id)
      .single();
    if (!school) return reply({ error: "École introuvable." }, 404);
    const version = b.kind === "mark" ? event.published_at || "" : "";
    const { data: job, error: je } = await admin
      .from("web_delivery_log")
      .insert({
        school_id: b.school_id,
        contact_id: contact.id,
        channel: b.channel,
        event_kind: b.kind,
        event_id: event.id,
        event_version: version,
        status: "sending",
        actor_id: auth.user.id,
      })
      .select("id")
      .single();
    if (je) {
      if (je.code === "23505")
        return reply(
          {
            error:
              "Cet envoi est déjà enregistré. Consultez son état dans l’historique avant toute relance.",
          },
          409,
        );
      throw Error();
    }
    const message = deliveryText(
      b.kind as DeliveryKind,
      event,
      school.name,
      person.name,
    );
    let result: Response;
    try {
      if (b.channel === "email") {
        const payload: any = {
          from: env("DELIVERY_FROM_EMAIL"),
          to: [contact.email],
          subject: message.subject,
          text: message.text,
        };
        if (["payment", "staff_payment"].includes(b.kind)) {
          const doc = new jsPDF();
          doc.setFontSize(16);
          doc.text(message.subject, 18, 22);
          doc.setFontSize(11);
          doc.text(doc.splitTextToSize(message.text, 170), 18, 40);
          payload.attachments = [
            {
              filename: "recu-" + event.id + ".pdf",
              content: doc.output("datauristring").split(",")[1],
            },
          ];
        }
        result = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + env("RESEND_API_KEY"),
            "Content-Type": "application/json",
            "Idempotency-Key": job.id,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        });
      } else {
        result = await fetch(
          "https://graph.facebook.com/" +
            env("WHATSAPP_GRAPH_VERSION") +
            "/" +
            encodeURIComponent(env("WHATSAPP_PHONE_NUMBER_ID")) +
            "/messages",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer " + env("WHATSAPP_ACCESS_TOKEN"),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: contact.phone.replace("+", ""),
              type: "template",
              template: {
                name: env("WHATSAPP_TEMPLATE_NAME"),
                language: { code: env("WHATSAPP_TEMPLATE_LANGUAGE") },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: contact.recipient_name },
                      { type: "text", text: school.name },
                      { type: "text", text: message.subject },
                    ],
                  },
                ],
              },
            }),
            signal: AbortSignal.timeout(15000),
            redirect: "error",
          },
        );
      }
    } catch {
      await admin
        .from("web_delivery_log")
        .update({ status: "uncertain" })
        .eq("id", job.id);
      return reply(
        {
          error:
            "Réponse du service non reçue. Vérifiez le journal du fournisseur avant de réessayer.",
        },
        502,
      );
    }
    let payload: any = {};
    try {
      payload = await result.json();
    } catch {}
    const providerId =
      b.channel === "email" ? payload.id : payload.messages?.[0]?.id;
    const accepted = result.ok && typeof providerId === "string";
    const { error: le } = await admin
      .from("web_delivery_log")
      .update({
        status: accepted ? "accepted" : "failed",
        provider_id: accepted ? providerId : null,
      })
      .eq("id", job.id);
    if (le)
      return reply(
        {
          error:
            "Vérification du statut requise auprès du fournisseur. Ne relancez pas cet envoi.",
        },
        502,
      );
    return accepted
      ? reply({
          status: "accepted",
          message:
            "Message accepté par le fournisseur. La réception n’est pas encore confirmée.",
        })
      : reply(
          {
            error:
              "Le fournisseur a refusé cet envoi. Consultez sa configuration.",
          },
          502,
        );
  } catch {
    return reply(
      {
        error:
          "Envoi impossible. Vérifiez vos droits et les informations saisies.",
      },
      400,
    );
  }
});
