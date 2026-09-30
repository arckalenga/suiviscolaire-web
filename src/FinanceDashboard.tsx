import { useEffect, useState } from "react";
import { db } from "./client";
import { financeTotals } from "./school-operations";
type Row = Record<string, any>;
export function FinanceDashboard({
  school,
  students,
  payments,
}: {
  school: Row;
  students: Row[];
  payments: Row[];
}) {
  const today = new Date().toLocaleDateString("en-CA");
  const [from, setFrom] = useState(today),
    [to, setTo] = useState(today),
    [outgoing, setOutgoing] = useState<Row[]>([]),
    [workers, setWorkers] = useState<Row[]>([]),
    [activity, setActivity] = useState<Row[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    setOutgoing([]);
    setActivity([]);
    async function load() {
      async function all(table: string) {
        let rows: Row[] = [];
        for (let offset = 0; ; offset += 1000) {
          const r = await db
            .from(table)
            .select("*")
            .eq("school_id", school.id)
            .order("id")
            .range(offset, offset + 999);
          if (r.error) throw Error();
          rows = rows.concat(r.data || []);
          if ((r.data?.length || 0) < 1000) return rows;
        }
      }
      try {
        const [p, w, a] = await Promise.all([
          all("web_staff_payments"),
          all("web_workers"),
          db
            .from("web_activity_log")
            .select("*")
            .eq("school_id", school.id)
            .order("created_at", { ascending: false })
            .limit(100),
        ]);
        if (a.error) throw Error();
        if (active) {
          setOutgoing(p);
          setWorkers(w);
          setActivity(a.data || []);
        }
      } catch {
        if (active) setError("Impossible de charger le suivi financier.");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [school.id, payments]);
  const incoming = payments.filter((p) => p.paid_on >= from && p.paid_on <= to),
    paid = outgoing.filter((p) => p.paid_on >= from && p.paid_on <= to);
  const combined: Row[] = [
    ...incoming.map((p) => ({
      ...p,
      direction: "Entrée",
      person: students.find((s) => s.id === p.student_id)?.name || "Élève",
    })),
    ...paid.map((p) => ({
      ...p,
      direction: "Sortie",
      person: workers.find((w) => w.id === p.worker_id)?.name || "Personnel",
    })),
  ].sort((a: Row, b: Row) => b.paid_on.localeCompare(a.paid_on));
  const labels: Record<string, string> = {
    web_payments: "Paiement élève",
    web_staff_payments: "Paiement personnel",
    web_student_attendance: "Présence élève",
    web_worker_attendance: "Présence personnel",
  };
  return (
    <section>
      <div className="panel toolbar">
        <label>
          Du
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Au
          <input
            type="date"
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          className="button secondary"
          onClick={() => {
            setFrom(today);
            setTo(today);
          }}
        >
          Aujourd’hui
        </button>
      </div>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      {from > to && (
        <p role="alert">La date de fin doit suivre la date de début.</p>
      )}
      <div className="stats">
        {financeTotals(incoming as any, paid as any).map((t) => (
          <section className="panel" key={t.currency}>
            <h2>{t.currency}</h2>
            <p>
              Reçus des élèves :{" "}
              <strong>{t.received.toLocaleString("fr-FR")}</strong>
            </p>
            <p>
              Versés au personnel :{" "}
              <strong>{t.paid.toLocaleString("fr-FR")}</strong>
            </p>
            <p>
              Différence : <strong>{t.net.toLocaleString("fr-FR")}</strong>
            </p>
          </section>
        ))}
      </div>
      <p className="muted">
        Montants enregistrés sur la période sélectionnée, séparés par devise. La
        différence ne constitue pas un solde bancaire.
      </p>
      <section className="panel">
        <h2>Mouvements · {combined.length}</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Sens</th>
                <th>Personne</th>
                <th>Libellé</th>
                <th>Référence</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              {combined.map((p) => (
                <tr key={p.direction + p.id}>
                  <td>{p.paid_on}</td>
                  <td>{p.direction}</td>
                  <td>{p.person}</td>
                  <td>{p.label}</td>
                  <td>{p.reference}</td>
                  <td>
                    {Number(p.amount).toLocaleString("fr-FR")} {p.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!combined.length && <p>Aucun mouvement sur cette période.</p>}
      </section>
      <section className="panel">
        <h2>Journal des opérations récentes</h2>
        <p>
          Les 100 dernières modifications de paiements et de présences
          enregistrées depuis l’activation de ce journal.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Activité</th>
                <th>Action</th>
                <th>Identifiant de l’auteur</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.created_at).toLocaleString("fr-FR")}</td>
                  <td>{labels[a.entity] || a.entity}</td>
                  <td>
                    {
                      {
                        INSERT: "Création",
                        UPDATE: "Modification",
                        DELETE: "Suppression",
                      }[a.operation as string]
                    }
                  </td>
                  <td>{a.actor_id || "Service"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
