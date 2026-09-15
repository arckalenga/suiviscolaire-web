import { useEffect, useState } from "react";
import { db } from "./client";
import { ActionForm, Input, checked, account, Credentials } from "./management";
type Row = Record<string, any>;
export function ParentManager({
  school,
  students,
}: {
  school: Row;
  students: Row[];
}) {
  const [parents, setParents] = useState<Row[]>([]),
    [links, setLinks] = useState<Row[]>([]),
    [chosen, setChosen] = useState<string[]>([]),
    [credentials, setCredentials] = useState<Row[]>([]),
    [message, setMessage] = useState("");
  async function load() {
    try {
      const [p, l] = await Promise.all([
        checked(db.from("web_parents").select("*")),
        checked(
          db.from("web_guardians").select("*").eq("school_id", school.id),
        ),
      ]);
      setParents(p);
      setLinks(l);
    } catch {
      setMessage("Impossible de charger les parents.");
    }
  }
  useEffect(() => {
    void load();
  }, [school.id]);
  return (
    <section>
      <p className="muted">
        Vérifiez l’identité du responsable et son lien avec chaque enfant avant
        de l’associer. Une même adresse parent peut être utilisée dans plusieurs
        écoles, sans nouveau mot de passe.
      </p>
      {message && <p role="status">{message}</p>}
      <details className="panel form-panel">
        <summary>Créer un parent / associer des enfants</summary>
        <ActionForm
          title="Compte parent"
          submit={async (f: Row) => {
            if (!chosen.length) throw Error("Choisissez au moins un enfant.");
            const r = await account({
              action: "create_parent",
              name: f.name,
              email: f.email,
              student_ids: chosen,
            });
            if (r.password) setCredentials([r]);
            setMessage(
              r.existing
                ? "Enfants associés au compte existant. Le mot de passe reste inchangé."
                : "Compte parent créé. Transmettez ses accès au responsable.",
            );
            await load();
          }}
        >
          <Input label="Nom du parent" name="name" />
          <Input label="Email du parent" name="email" type="email" />
          <fieldset>
            <legend>Enfants dans cette école</legend>
            {students
              .filter((s) => !s.archived)
              .map((s) => (
                <label className="checkbox" key={s.id}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(s.id)}
                    onChange={(e) =>
                      setChosen(
                        e.target.checked
                          ? [...chosen, s.id]
                          : chosen.filter((id) => id !== s.id),
                      )
                    }
                  />
                  {s.name} · {s.class_name}
                </label>
              ))}
          </fieldset>
        </ActionForm>
      </details>
      <Credentials rows={credentials} />
      <section className="panel">
        <h2>Parents et enfants associés</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Parent</th>
                <th>Enfant</th>
                <th>Accès</th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.parent_id + l.student_id}>
                  <td>
                    {parents.find((p) => p.user_id === l.parent_id)?.name}
                    <br />
                    {parents.find((p) => p.user_id === l.parent_id)?.email}
                  </td>
                  <td>{students.find((s) => s.id === l.student_id)?.name}</td>
                  <td>
                    <button
                      className="button secondary"
                      onClick={async () => {
                        try {
                          await account({
                            action: "parent_access",
                            parent_id: l.parent_id,
                            student_id: l.student_id,
                            active: !l.active,
                          });
                          await load();
                        } catch {
                          setMessage("Modification refusée.");
                        }
                      }}
                    >
                      {l.active ? "Retirer ce lien" : "Rétablir ce lien"}
                    </button>
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
export function FamilyHome({
  schools,
  open,
}: {
  schools: Row[];
  open: (school: Row, child: string, tab?: string) => void;
}) {
  const [children, setChildren] = useState<Row[]>([]),
    [notes, setNotes] = useState<Row[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    async function load() {
      const [c, n] = await Promise.all([
        db.from("web_students").select("*").order("name"),
        db
          .from("web_notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (!alive) return;
      if (c.error) setError("Impossible de charger les enfants.");
      else if (n.error)
        setError("Les notifications sont momentanément indisponibles.");
      else setError("");
      setChildren(c.data || []);
      setNotes(n.data || []);
    }
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [schools]);
  return (
    <section>
      <h1>Mes enfants</h1>
      <p>Un seul compte pour suivre toute votre famille.</p>
      {error && <p role="alert">{error}</p>}
      <div className="school-grid">
        {children.map((c) => (
          <button
            className="school-card"
            key={c.id}
            onClick={() => {
              const s = schools.find((s) => s.id === c.school_id);
              if (s) open(s, c.id);
            }}
          >
            <h2>{c.name}</h2>
            <p>{schools.find((s) => s.id === c.school_id)?.name}</p>
            <p>{c.class_name}</p>
            <span>Ouvrir son espace →</span>
          </button>
        ))}
      </div>
      {!children.length && (
        <p>Aucun enfant associé. Contactez l’administration de l’école.</p>
      )}
      <section className="panel">
        <h2>Notifications de ma famille</h2>
        {notes.map((n) => (
          <article className="notification" key={n.id}>
            <div>
              <h3>{n.title}</h3>
              <small>{schools.find((s) => s.id === n.school_id)?.name}</small>
              <p>{n.body}</p>
            </div>
            <button
              className="button secondary"
              onClick={() => {
                const s = schools.find((s) => s.id === n.school_id);
                const child =
                  children.find(
                    (c) => c.school_id === n.school_id && c.id === n.student_id,
                  ) || children.find((c) => c.school_id === n.school_id);
                if (s && child) open(s, child.id, n.destination);
              }}
            >
              Consulter
            </button>
          </article>
        ))}
      </section>
    </section>
  );
}
