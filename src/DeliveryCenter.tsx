import { schoolRows } from "./school-data";
import { useEffect, useState } from "react";
import { db } from "./client";
import { ActionForm, Input, checked } from "./management";
import { invokeAuthenticated } from "./auth-invoke";
import { eligibleRecipient } from "../supabase/functions/web-delivery/delivery-policy.ts";
type Row = Record<string, any>;
async function delivery(body: Row) {
  const { data, error } = await invokeAuthenticated(db, "web-delivery", body);
  if (error) {
    let message = "Envoi impossible.";
    try {
      message = (await error.context.json()).error || message;
    } catch {}
    throw Error(message);
  }
  if (data?.error) throw Error(data.error);
  return data;
}
export function SendNotice({
  schoolId,
  kind,
  eventId,
  studentId,
  workerId,
}: {
  schoolId: string;
  kind: string;
  eventId: string;
  studentId?: string;
  workerId?: string;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function send(channel: string) {
    setBusy(true);
    setMessage("");
    try {
      const contact = await checked(
        db
          .from("web_delivery_contacts")
          .select("id")
          .eq("school_id", schoolId)
          .eq(studentId ? "student_id" : "worker_id", studentId || workerId)
          .maybeSingle(),
      );
      if (!contact)
        throw Error(
          "Enregistrez d’abord un destinataire dans « Envois & contacts ».",
        );
      const result = await delivery({
        action: "send",
        school_id: schoolId,
        kind,
        event_id: eventId,
        contact_id: contact.id,
        channel,
      });
      setMessage(result.message);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="row-actions">
      <button disabled={busy} onClick={() => void send("email")}>
        Envoyer le reçu par email
      </button>
      <button disabled={busy} onClick={() => void send("whatsapp")}>
        Notifier par WhatsApp
      </button>
      {message && <small role="status">{message}</small>}
    </div>
  );
}
export function DeliveryCenter({
  school,
  students,
  assignments,
  marks,
  messages,
  canAcademic,
  canFinance,
}: {
  school: Row;
  students: Row[];
  assignments: Row[];
  marks: Row[];
  messages: Row[];
  canAcademic: boolean;
  canFinance: boolean;
}) {
  const [contacts, setContacts] = useState<Row[]>([]),
    [workers, setWorkers] = useState<Row[]>([]),
    [history, setHistory] = useState<Row[]>([]),
    [configured, setConfigured] = useState({ email: false, whatsapp: false }),
    [person, setPerson] = useState(""),
    [kind, setKind] = useState("message"),
    [eventId, setEventId] = useState(""),
    [channel, setChannel] = useState("email"),
    [recipient, setRecipient] = useState("all"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setError("");
    try {
      const [c, w, h, status] = await Promise.all([
        schoolRows("web_delivery_contacts", school.id),
        schoolRows("web_workers", school.id),
        checked(
          db
            .from("web_delivery_log")
            .select("*")
            .eq("school_id", school.id)
            .order("created_at", { ascending: false })
            .limit(100),
        ),
        delivery({ action: "status", school_id: school.id }),
      ]);
      setContacts(c);
      setWorkers(w);
      setHistory(h);
      setConfigured(status);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [school.id]);
  const people: Row[] = [
    ...students
      .filter((s) => !s.archived)
      .map((s) => ({
        ...s,
        value: "student:" + s.id,
        label: s.name + " · " + s.class_name,
      })),
    ...workers
      .filter((w) => w.active)
      .map((w) => ({
        ...w,
        value: "worker:" + w.id,
        label: w.name + " · Personnel",
      })),
  ];
  const selected = people.find((p) => p.value === person),
    isStudent = person.startsWith("student:");
  const contact = contacts.find(
    (c) => selected && (isStudent ? c.student_id : c.worker_id) === selected.id,
  );
  const events =
      kind === "message" ? messages : assignments.filter((a) => a.published),
    event = events.find((e) => e.id === eventId);
  const targets = event
    ? contacts.filter((c) =>
        eligibleRecipient(
          kind as any,
          event,
          c,
          students.find((s) => s.id === c.student_id),
          marks.some(
            (m) =>
              m.assignment_id === event.id && m.student_id === c.student_id,
          ),
        ),
      )
    : [];
  return (
    <section>
      <section className="panel">
        <h2>Envoi depuis le compte de l’établissement</h2>
        <p>
          Email :{" "}
          <strong>{configured.email ? "Connecté" : "Non configuré"}</strong> ·
          WhatsApp :{" "}
          <strong>{configured.whatsapp ? "Connecté" : "Non configuré"}</strong>
        </p>
        <p>
          Le destinataire est enregistré ici une seule fois. Les envois
          utilisent ensuite le service de l’établissement, sans ouvrir votre
          WhatsApp personnel. Aucun message ne part tant que le service n’est
          pas connecté.
        </p>
        <p>
          La connexion nécessite un service email et un compte WhatsApp Business
          Platform. Les clés sont configurées côté serveur par l’administrateur
          principal.
        </p>
      </section>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {(canAcademic || canFinance) && (
        <section className="panel">
          <h2>Destinataire d’un élève ou d’un membre du personnel</h2>
          <label>
            Personne concernée
            <select value={person} onChange={(e) => setPerson(e.target.value)}>
              <option value="">Choisir une personne</option>
              {people.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <p>
            Pour un élève, indiquez les coordonnées du parent ou responsable
            autorisé. L’adresse de connexion de l’élève n’est pas utilisée
            automatiquement comme adresse de réception.
          </p>
          {selected && (
            <ActionForm
              key={person + String(contact?.id)}
              title="Coordonnées de réception"
              submit={async (f) => {
                const data = {
                  school_id: school.id,
                  student_id: isStudent ? selected.id : null,
                  worker_id: isStudent ? null : selected.id,
                  recipient_name: f.recipient_name.trim(),
                  email: f.email.trim().toLowerCase(),
                  phone: f.phone.trim(),
                  email_consent: f.email_consent === "on",
                  whatsapp_consent: f.whatsapp_consent === "on",
                };
                await checked(
                  contact
                    ? db
                        .from("web_delivery_contacts")
                        .update(data)
                        .eq("id", contact.id)
                    : db.from("web_delivery_contacts").insert(data),
                );
                await load();
              }}
            >
              <Input
                label="Nom du destinataire"
                name="recipient_name"
                value={contact?.recipient_name || ""}
                maxLength={150}
              />
              <Input
                label="Email de réception"
                name="email"
                type="email"
                required={false}
                value={contact?.email || ""}
              />
              <Input
                label="WhatsApp au format international (+243…)"
                name="phone"
                type="tel"
                pattern="[+][1-9][0-9]{7,14}"
                required={false}
                value={contact?.phone || ""}
              />
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="email_consent"
                  defaultChecked={contact?.email_consent || false}
                />
                Le destinataire accepte les notifications par email.
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="whatsapp_consent"
                  defaultChecked={contact?.whatsapp_consent || false}
                />
                Le destinataire accepte les notifications WhatsApp.
              </label>
            </ActionForm>
          )}
        </section>
      )}
      {canAcademic && (
        <section className="panel">
          <h2>Notifier une publication</h2>
          <div className="toolbar">
            <label>
              Type
              <select
                disabled={busy}
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setEventId("");
                  setRecipient("all");
                }}
              >
                <option value="message">Communication</option>
                <option value="mark">Note publiée</option>
              </select>
            </label>
            <label>
              Publication
              <select
                disabled={busy}
                value={eventId}
                onChange={(e) => {
                  setEventId(e.target.value);
                  setRecipient("all");
                }}
              >
                <option value="">Choisir</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                    {e.class_name ? " · " + e.class_name : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Canal
              <select
                disabled={busy}
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </label>
            <label>
              Destinataires
              <select
                disabled={busy}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              >
                <option value="all">
                  Tous les destinataires concernés ({targets.length})
                </option>
                {targets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.recipient_name} ·{" "}
                    {students.find((s) => s.id === c.student_id)?.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p>
            Les notes restent dans le compte scolaire. Les communications
            ciblent uniquement les élèves de la classe, de l’école ou l’élève
            choisi lors de la publication.
          </p>
          <button
            className="button"
            disabled={
              busy ||
              !event ||
              !targets.length ||
              !configured[channel as "email" | "whatsapp"]
            }
            onClick={async () => {
              setBusy(true);
              setError("");
              setNotice("");
              let accepted = 0,
                failed = 0;
              for (const c of targets.filter(
                (c) => recipient === "all" || c.id === recipient,
              )) {
                try {
                  await delivery({
                    action: "send",
                    school_id: school.id,
                    kind,
                    event_id: eventId,
                    contact_id: c.id,
                    channel,
                  });
                  accepted++;
                } catch {
                  failed++;
                }
              }
              await load();
              setNotice(
                accepted +
                  " envoi(s) accepté(s) par le fournisseur, " +
                  failed +
                  " non envoyé(s) ou déjà enregistré(s).",
              );
              setBusy(false);
            }}
          >
            Envoyer la notification
          </button>
        </section>
      )}
      {canFinance && (
        <p>
          Les boutons d’envoi des reçus se trouvent dans « Paiements » et «
          Personnel & salaires ».
        </p>
      )}
      <section className="panel">
        <h2>Historique des envois</h2>
        <p>
          « Accepté » signifie accepté par le fournisseur, pas encore reçu ou
          lu. Les tentatives déjà enregistrées ne sont pas renvoyées
          automatiquement.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Destinataire</th>
                <th>Canal</th>
                <th>Type</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.created_at).toLocaleString("fr-FR")}</td>
                  <td>
                    {contacts.find((c) => c.id === h.contact_id)
                      ?.recipient_name || "Contact"}
                  </td>
                  <td>{h.channel}</td>
                  <td>
                    {
                      {
                        payment: "Reçu élève",
                        staff_payment: "Paiement personnel",
                        mark: "Note",
                        message: "Communication",
                      }[h.event_kind as string]
                    }
                  </td>
                  <td>
                    {
                      {
                        sending: "En cours / à vérifier",
                        accepted: "Accepté par le fournisseur",
                        failed: "Refusé",
                        uncertain: "Réception à vérifier",
                      }[h.status as string]
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!history.length && <p>Aucun envoi enregistré.</p>}
      </section>
    </section>
  );
}
