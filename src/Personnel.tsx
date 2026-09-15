import { useEffect, useState } from "react";
import { db } from "./client";
import { ActionForm, Input, Select, checked } from "./management";
type Row = Record<string, any>;
export function Personnel({
  school,
  subjects,
}: {
  school: Row;
  subjects: Row[];
}) {
  const [workers, setWorkers] = useState<Row[]>([]),
    [links, setLinks] = useState<Row[]>([]),
    [payments, setPayments] = useState<Row[]>([]),
    [error, setError] = useState("");
  async function load() {
    try {
      const [w, l, p] = await Promise.all([
        checked(
          db
            .from("web_workers")
            .select("*")
            .eq("school_id", school.id)
            .order("name"),
        ),
        checked(
          db
            .from("web_teacher_subjects")
            .select("*")
            .eq("school_id", school.id),
        ),
        checked(
          db
            .from("web_staff_payments")
            .select("*")
            .eq("school_id", school.id)
            .order("paid_on", { ascending: false }),
        ),
      ]);
      setWorkers(w);
      setLinks(l);
      setPayments(p);
    } catch {
      setError("Impossible de charger le personnel.");
    }
  }
  useEffect(() => {
    void load();
  }, [school.id]);
  const choices = workers
    .filter((w) => w.active)
    .map((w) => ({ value: w.id, label: w.name }));
  return (
    <section>
      {error && <p role="alert">{error}</p>}
      <div className="stats">
        {["CDF", "USD"].map((c) => (
          <section className="panel" key={c}>
            <small>Paiements du personnel · {c}</small>
            <h2>
              {payments
                .filter((p) => p.currency === c)
                .reduce((s, p) => s + Number(p.amount), 0)
                .toLocaleString("fr-FR")}{" "}
              {c}
            </h2>
            <p>Total enregistré, toutes dates</p>
          </section>
        ))}
      </div>
      <div className="two-columns">
        <details className="panel form-panel">
          <summary>Ajouter un enseignant ou travailleur</summary>
          <ActionForm
            title="Personnel de l’école"
            submit={async (f: Row) => {
              await checked(
                db
                  .from("web_workers")
                  .insert({
                    school_id: school.id,
                    name: f.name.trim(),
                    kind: f.kind,
                  }),
              );
              await load();
            }}
          >
            <Input label="Nom complet" name="name" maxLength={150} />
            <Select
              label="Fonction"
              name="kind"
              items={[
                { value: "teacher", label: "Enseignant" },
                { value: "worker", label: "Travailleur" },
              ]}
            />
          </ActionForm>
        </details>
        <details className="panel form-panel">
          <summary>Enregistrer un paiement au personnel</summary>
          {choices.length ? (
            <ActionForm
              title="Paiement effectué"
              submit={async (f: Row) => {
                await checked(
                  db
                    .from("web_staff_payments")
                    .insert({
                      ...f,
                      school_id: school.id,
                      amount: Number(f.amount),
                    }),
                );
                await load();
              }}
            >
              <Select label="Bénéficiaire" name="worker_id" items={choices} />
              <Input label="Libellé / période" name="label" maxLength={200} />
              <Input
                label="Montant"
                name="amount"
                type="number"
                min=".01"
                step=".01"
              />
              <Select
                label="Devise"
                name="currency"
                items={["CDF", "USD"]}
                value={school.currency}
              />
              <Input label="Date du paiement" name="paid_on" type="date" />
              <Input label="Référence" name="reference" maxLength={150} />
            </ActionForm>
          ) : (
            <p>Ajoutez d’abord un membre du personnel.</p>
          )}
        </details>
      </div>
      <section className="panel">
        <h2>Personnel et branches</h2>
        <p className="muted">
          Ces fiches sont facultatives et ne créent pas de compte de connexion.
        </p>
        {workers.map((w) => (
          <article key={w.id} className="panel">
            <h3>
              {w.name} · {w.kind === "teacher" ? "Enseignant" : "Travailleur"}
            </h3>
            <p>{w.active ? "Actif" : "Inactif"}</p>
            {w.kind === "teacher" && (
              <fieldset>
                <legend>Branches enseignées</legend>
                {subjects.map((s) => (
                  <label className="checkbox" key={s.id}>
                    <input
                      type="checkbox"
                      checked={links.some(
                        (l) => l.worker_id === w.id && l.subject_id === s.id,
                      )}
                      onChange={async (e) => {
                        try {
                          await checked(
                            e.target.checked
                              ? db
                                  .from("web_teacher_subjects")
                                  .insert({
                                    school_id: school.id,
                                    worker_id: w.id,
                                    subject_id: s.id,
                                  })
                              : db
                                  .from("web_teacher_subjects")
                                  .delete()
                                  .eq("worker_id", w.id)
                                  .eq("subject_id", s.id),
                          );
                          await load();
                        } catch {
                          setError("Modification refusée.");
                        }
                      }}
                    />
                    {s.name}
                  </label>
                ))}
              </fieldset>
            )}
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  const rows = await checked(
                    db
                      .from("web_workers")
                      .update({ active: !w.active })
                      .eq("id", w.id)
                      .select(),
                  );
                  if (!rows.length) throw Error();
                  await load();
                } catch {
                  setError("Modification refusée.");
                }
              }}
            >
              {w.active ? "Désactiver" : "Réactiver"}
            </button>
          </article>
        ))}
        {!workers.length && <p>Aucun membre du personnel enregistré.</p>}
      </section>
      <section className="panel">
        <h2>Historique des paiements au personnel</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Bénéficiaire</th>
                <th>Libellé</th>
                <th>Référence</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.paid_on}</td>
                  <td>{workers.find((w) => w.id === p.worker_id)?.name}</td>
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
      </section>
    </section>
  );
}
