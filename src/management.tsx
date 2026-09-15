import {
  studentEmail,
  slug,
} from "../supabase/functions/web-manage-accounts/student-access.ts";
import { useEffect, useState, type ReactNode } from "react";
import {
  Plus,
  Upload,
  Download,
  Bell,
  BookOpen,
  GraduationCap,
  Wallet,
  MessageSquare,
  CalendarDays,
  ArrowRight,
  CreditCard,
} from "lucide-react";
import { db } from "./client";
import {
  readWorkbook,
  downloadWorkbook,
  validateStudents,
  validateMarks,
} from "./imports";
type Row = Record<string, any>;
type Refresh = () => Promise<void>;
export async function checked(q: any) {
  const r = await q;
  if (r.error)
    throw Error(
      "Enregistrement refusé. Vérifiez les valeurs, les doublons et vos droits.",
    );
  return r.data;
}
async function account(body: Row) {
  const { data, error } = await db.functions.invoke("web-manage-accounts", {
    body,
  });
  if (error) {
    let message =
      "Opération impossible. Vérifiez votre connexion et vos droits.";
    try {
      const payload = await error.context.json();
      message = payload.error || message;
    } catch {}
    throw Error(message);
  }
  if (data?.error) throw Error(data.error);
  return data;
}
function Feedback({ error, notice }: { error: string; notice?: string }) {
  return (
    <>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
    </>
  );
}
export function Input({
  label,
  name,
  value = "",
  required = true,
  type = "text",
  ...rest
}: any) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        {...rest}
      />
    </label>
  );
}
export function Select({ label, name, items, value, onChange }: any) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={value} required onChange={onChange}>
        {items.map((x: any) => (
          <option
            key={typeof x === "string" ? x : x.value}
            value={typeof x === "string" ? x : x.value}
          >
            {typeof x === "string" ? x : x.label}
          </option>
        ))}
      </select>
    </label>
  );
}
export function ActionForm({
  title,
  children,
  submit,
  label = "Enregistrer",
}: {
  title: string;
  children: ReactNode;
  submit: (v: Row) => Promise<void>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  return (
    <form
      className="edit-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const values = Object.fromEntries(new FormData(e.currentTarget));
        setBusy(true);
        setError("");
        setNotice("");
        try {
          await submit(values);
          setNotice("Enregistrement effectué.");
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{title}</h3>
      <div className="form-feedback">
        <Feedback error={error} notice={notice} />
      </div>
      {children}
      <button className="button" disabled={busy}>
        {busy ? "Enregistrement…" : label}
      </button>
    </form>
  );
}
function Credentials({ rows }: { rows: Row[] }) {
  return rows.length ? (
    <section className="credential-result">
      <h3>Identifiants créés — à conserver</h3>
      <p>
        Les mots de passe sont affichés uniquement dans cette session.
        Transmettez chaque identifiant à la personne concernée.
      </p>
      <button
        className="button secondary"
        onClick={() =>
          downloadWorkbook(
            "identifiants-prives.xlsx",
            rows.map((r) => ({ Email: r.email, "Mot de passe": r.password })),
          )
        }
      >
        <Download size={16} />
        Télécharger les identifiants privés
      </button>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Mot de passe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.email}>
                <td>{r.email}</td>
                <td>
                  <input
                    type="password"
                    readOnly
                    value={r.password}
                    aria-label={"Mot de passe de " + r.email}
                  />
                  <button
                    className="text-button"
                    onClick={() => navigator.clipboard.writeText(r.password)}
                  >
                    Copier le mot de passe
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  ) : null;
}
export function MainControls({
  schools,
  refresh,
}: {
  schools: Row[];
  refresh: Refresh;
}) {
  const [credentials, setCredentials] = useState<Row[]>([]),
    [staff, setStaff] = useState<Row[]>([]),
    [members, setMembers] = useState<Row[]>([]),
    [chosen, setChosen] = useState<string[]>([]),
    [staffError, setStaffError] = useState(""),
    [staffBusy, setStaffBusy] = useState(false);
  async function load() {
    const [s, m] = await Promise.all([
      db.from("web_staff").select("*"),
      db.from("web_memberships").select("*").eq("role", "subadmin"),
    ]);
    setStaff(s.data || []);
    setMembers(m.data || []);
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="admin-directory-controls">
      <div className="two-columns">
        <details className="panel form-panel">
          <summary>
            <Plus size={16} /> Créer une école
          </summary>
          <ActionForm
            title="Nouvel établissement"
            label="Créer l’école"
            submit={async (f) => {
              await checked(
                db.from("web_schools").insert({
                  name: f.name,
                  city: f.city,
                  currency: f.currency,
                  academic_year: f.academic_year,
                }),
              );
              await refresh();
            }}
          >
            <Input label="Nom de l’école" name="name" />
            <Input label="Ville" name="city" />
            <Input
              label="Année scolaire"
              name="academic_year"
              value="2026-2027"
            />
            <Select label="Devise" name="currency" items={["CDF", "USD"]} />
          </ActionForm>
        </details>
        <details className="panel form-panel">
          <summary>
            <Plus size={16} /> Créer un sous-administrateur
          </summary>
          <ActionForm
            title="Nouvel accès de gestion"
            label="Créer le sous-administrateur"
            submit={async (f) => {
              if (!chosen.length) throw Error("Choisissez au moins une école.");
              const result = await account({
                action: "create_subadmin",
                name: f.name,
                email: f.email,
                school_ids: chosen,
              });
              setCredentials((c) => [...c, result]);
              await load();
            }}
          >
            <Input label="Nom complet" name="name" />
            <Input label="Email" name="email" type="email" />
            <fieldset className="school-checkboxes">
              <legend>Écoles autorisées</legend>
              {schools.map((s) => (
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
                  {s.name}
                </label>
              ))}
            </fieldset>
          </ActionForm>
        </details>
      </div>
      <Credentials rows={credentials} />
      <details open className="panel form-panel">
        <summary>Gérer les sous-administrateurs ({staff.length})</summary>
        <Feedback error={staffError} />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Écoles attribuées</th>
                <th>Accès</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.user_id}>
                  <td>{s.name}</td>
                  <td>{s.email}</td>
                  <td>
                    {members
                      .filter((m) => m.user_id === s.user_id)
                      .map(
                        (m) => schools.find((s) => s.id === m.school_id)?.name,
                      )
                      .join(", ")}
                  </td>
                  <td>
                    <button
                      className="button secondary"
                      disabled={staffBusy}
                      onClick={async () => {
                        setStaffBusy(true);
                        setStaffError("");
                        try {
                          await checked(
                            db.rpc("web_set_subadmin_active", {
                              target: s.user_id,
                              enabled: !members.some(
                                (m) => m.user_id === s.user_id && m.active,
                              ),
                            }),
                          );
                          await load();
                        } catch {
                          setStaffError("Modification des accès refusée.");
                        } finally {
                          setStaffBusy(false);
                        }
                      }}
                    >
                      {members.some((m) => m.user_id === s.user_id && m.active)
                        ? "Désactiver"
                        : "Réactiver"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
export function StudentActions({
  go,
  unread,
}: {
  go: (tab: string) => void;
  unread: number;
}) {
  return (
    <div className="student-actions">
      {[
        [
          "marks",
          "Voir les points",
          "Devoirs, interrogations et examens",
          BookOpen,
        ],
        [
          "payments",
          "Voir les paiements",
          "Retrouver les versements enregistrés",
          Wallet,
        ],
        [
          "bulletin",
          "Voir le bulletin",
          "Consulter et imprimer mes résultats",
          GraduationCap,
        ],
        [
          "messages",
          "Voir les communiqués de l’école",
          "Les informations qui me concernent",
          MessageSquare,
        ],
        [
          "notifications",
          "Voir les notifications",
          unread + " notification(s) non lue(s)",
          Bell,
        ],
        ["online", "Payer en ligne", "Bientôt disponible", CreditCard],
        ["timetable", "Voir l’horaire", "Organiser ma semaine", CalendarDays],
      ].map(([id, title, body, Icon]: any) => (
        <button className="student-action" key={id} onClick={() => go(id)}>
          <span>
            <Icon size={25} />
          </span>
          <h3>{title}</h3>
          <p>{body}</p>
          <ArrowRight size={17} />
        </button>
      ))}
    </div>
  );
}
function StudentLoginFields({ domain }: { domain: string }) {
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [manual, setManual] = useState(false);
  return (
    <>
      <label>
        Nom complet
        <input
          name="name"
          required
          maxLength={150}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!manual) setEmail(studentEmail(e.target.value, domain));
          }}
        />
      </label>
      <label>
        Email de connexion
        <input
          aria-label="Email de connexion"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setManual(true);
          }}
        />
        <small className="field-help">
          Identifiant @{domain}. En cas d’homonyme, ajoutez le matricule avant
          @. Mot de passe généré : 6 caractères.
        </small>
      </label>
    </>
  );
}
export function StudentsManager({
  school,
  students,
  classes,
  refresh,
  view,
}: {
  school: Row;
  students: Row[];
  classes: Row[];
  refresh: Refresh;
  view: (id: string) => void;
}) {
  const [editing, setEditing] = useState<Row | null>(null),
    [query, setQuery] = useState(""),
    [credentials, setCredentials] = useState<Row[]>([]),
    [preview, setPreview] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [includeArchived, setIncludeArchived] = useState(false);
  const names = classes.map((c) => c.name);
  const domain =
    school.student_email_domain || (slug(school.name) || "ecole") + ".com";
  async function create(f: Row) {
    const r = await account({
      action: "create_student",
      school_ids: [school.id],
      name: f.nom || f.name,
      email: f.email,
      class_name: f.classe || f.class_name,
      matricule: f.matricule,
      sex: f.sexe || f.sex,
      birth_date: f.naissance || f.birth_date,
    });
    setCredentials((c) => [...c, r]);
    return r;
  }
  return (
    <>
      <Feedback error={error} notice={notice} />
      <div className="two-columns">
        <details className="panel form-panel">
          <summary>Ajouter un élève</summary>
          {names.length ? (
            <ActionForm
              title="Nouvel élève et accès personnel"
              label="Créer l’élève"
              submit={async (f) => {
                await create(f);
                await refresh();
              }}
            >
              <StudentLoginFields key={school.id + domain} domain={domain} />
              <Input label="Matricule" name="matricule" maxLength={60} />
              <Select label="Classe" name="class_name" items={names} />
              <Select label="Sexe" name="sex" items={["F", "M"]} />
              <Input
                label="Date de naissance"
                name="birth_date"
                type="date"
                required={false}
              />
            </ActionForm>
          ) : (
            <p>Créez d’abord une classe dans « Classes & cours ».</p>
          )}
        </details>
        <section className="panel">
          <h3>Importer des élèves depuis Excel</h3>
          <p className="muted">
            Colonnes : Matricule, Nom, Classe, Email (facultatif), Sexe,
            Naissance. Sans email, un identifiant @{domain} est proposé. Un mot
            de passe de 6 caractères est généré par élève.
          </p>
          <button
            className="button secondary"
            onClick={() =>
              downloadWorkbook("modele-eleves.xlsx", [
                {
                  Matricule: "EL-001",
                  Nom: "Nom de l’élève",
                  Classe: names[0] || "1ère primaire",
                  Email: studentEmail("Nom Eleve", domain),
                  Sexe: "F",
                  Naissance: "2018-01-15",
                },
              ])
            }
          >
            <Download size={16} />
            Modèle Excel élèves
          </button>
          <label className="upload-label">
            Choisir le fichier élèves
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setError("");
                setPreview([]);
                try {
                  setPreview(
                    validateStudents(
                      await readWorkbook(file),
                      names,
                      students as any,
                      domain,
                    ),
                  );
                } catch (err) {
                  setError((err as Error).message);
                }
                e.target.value = "";
              }}
            />
          </label>
        </section>
      </div>
      {preview.length > 0 && (
        <section className="panel">
          <h3>Aperçu de l’import élèves · {preview.length} lignes</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Ligne</th>
                  <th>Matricule</th>
                  <th>Nom</th>
                  <th>Classe</th>
                  <th>Validation</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i}>
                    <td>{r.line}</td>
                    <td>{r.matricule}</td>
                    <td>{r.nom}</td>
                    <td>{r.classe}</td>
                    <td>{r.errors.join(" · ") || "Prêt"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="button"
            disabled={busy || preview.some((r) => r.errors.length)}
            onClick={async () => {
              setBusy(true);
              setError("");
              const failed: Row[] = [];
              let count = 0;
              for (const r of preview) {
                try {
                  await create(r);
                  count++;
                } catch (err) {
                  failed.push({ ...r, errors: [(err as Error).message] });
                }
              }
              setPreview(failed);
              setNotice(
                count +
                  " élève(s) créé(s). " +
                  failed.length +
                  " ligne(s) à corriger.",
              );
              setBusy(false);
              await refresh();
            }}
          >
            <Upload size={16} />
            {busy ? "Import en cours…" : "Confirmer l’import des élèves"}
          </button>
          <p className="muted">
            Les lignes déjà créées ne seront pas réimportées. En cas d’échec
            partiel, seules les lignes en erreur restent dans l’aperçu.
          </p>
        </section>
      )}
      <Credentials rows={credentials} />
      {editing && (
        <section className="panel">
          <ActionForm
            key={editing.id}
            title={"Modifier · " + editing.name}
            submit={async (f) => {
              const rows = await checked(
                db
                  .from("web_students")
                  .update({
                    name: f.name,
                    matricule: f.matricule,
                    class_name: f.class_name,
                    sex: f.sex,
                    birth_date: f.birth_date || null,
                  })
                  .eq("id", editing.id)
                  .eq("school_id", school.id)
                  .select(),
              );
              if (!rows.length) throw Error("Modification refusée.");
              setEditing(null);
              await refresh();
            }}
          >
            <Input label="Nom complet" name="name" value={editing.name} />
            <Input
              label="Matricule"
              name="matricule"
              value={editing.matricule}
            />
            <Select
              label="Classe"
              name="class_name"
              value={editing.class_name}
              items={names}
            />
            <Select
              label="Sexe"
              name="sex"
              value={editing.sex}
              items={["F", "M"]}
            />
            <Input
              label="Date de naissance"
              name="birth_date"
              value={editing.birth_date || ""}
              type="date"
              required={false}
            />
            <p className="muted">
              Un élève déjà noté conserve sa classe afin de protéger ses
              résultats.
            </p>
          </ActionForm>
          <button className="text-button" onClick={() => setEditing(null)}>
            Annuler la modification
          </button>
        </section>
      )}
      <section className="panel">
        <div className="panel-title">
          <h2>Élèves de l’établissement</h2>
          <input
            className="compact-search"
            aria-label="Rechercher un élève"
            placeholder="Nom ou matricule…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Inclure les élèves retirés
        </label>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Matricule</th>
                <th>Élève</th>
                <th>Classe</th>
                <th>État</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students
                .filter(
                  (s) =>
                    (includeArchived || !s.archived) &&
                    (s.name + " " + s.matricule)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((s) => (
                  <tr key={s.id}>
                    <td>{s.matricule}</td>
                    <td>{s.name}</td>
                    <td>{s.class_name}</td>
                    <td>{s.archived ? "Retiré" : "Actif"}</td>
                    <td>
                      <div className="row-actions">
                        <button onClick={() => view(s.id)}>Résultats</button>
                        <button onClick={() => setEditing(s)}>Modifier</button>
                        <button
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            setError("");
                            try {
                              const rows = await checked(
                                db
                                  .from("web_students")
                                  .update({
                                    bulletin_blocked: !s.bulletin_blocked,
                                  })
                                  .eq("id", s.id)
                                  .eq("school_id", school.id)
                                  .select(),
                              );
                              if (!rows.length) throw Error();
                              await refresh();
                            } catch {
                              setError(
                                "Modification de l’accès au bulletin refusée.",
                              );
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {s.bulletin_blocked
                            ? "Autoriser le bulletin"
                            : "Bloquer le bulletin"}
                        </button>
                        <button
                          disabled={busy}
                          onClick={async () => {
                            if (
                              !confirm(
                                s.archived
                                  ? "Rétablir l’accès de cet élève ?"
                                  : "Retirer cet élève et désactiver son accès ? Ses notes et paiements seront conservés.",
                              )
                            )
                              return;
                            setBusy(true);
                            setError("");
                            try {
                              await account({
                                action: "archive_student",
                                student_id: s.id,
                                archived: !s.archived,
                              });
                              await refresh();
                            } catch (err) {
                              setError((err as Error).message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {s.archived ? "Rétablir" : "Retirer"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
export function ClassManager({
  school,
  classes,
  subjects,
  refresh,
}: {
  school: Row;
  classes: Row[];
  subjects: Row[];
  refresh: Refresh;
}) {
  return (
    <>
      <div className="two-columns">
        <section className="panel">
          <ActionForm
            title="Créer une classe"
            submit={async (f) => {
              await checked(
                db
                  .from("web_classes")
                  .insert({ school_id: school.id, name: f.name.trim() }),
              );
              await refresh();
            }}
          >
            <Input
              label="Nom de la classe"
              name="name"
              placeholder="Ex. 2ème primaire A"
            />
          </ActionForm>
          <ul className="class-list">
            {classes.map((c) => (
              <li key={c.id}>
                <GraduationCap size={18} />
                {c.name}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <ActionForm
            title="Ajouter une branche / un cours"
            submit={async (f) => {
              await checked(
                db.from("web_subjects").insert({
                  school_id: school.id,
                  name: f.name,
                  domain: f.domain,
                  period_max: Number(f.period_max),
                  exam_max: Number(f.exam_max),
                  sort_order: subjects.length,
                }),
              );
              await refresh();
            }}
          >
            <Input label="Nom de la branche" name="name" />
            <Input label="Domaine" name="domain" />
            <Input
              label="Maximum par période"
              name="period_max"
              type="number"
              min="1"
              value="20"
            />
            <Input
              label="Maximum à l’examen"
              name="exam_max"
              type="number"
              min="1"
              value="40"
            />
          </ActionForm>
        </section>
      </div>
      <section className="panel">
        <h2>Branches enseignées</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Branche</th>
                <th>Domaine</th>
                <th>Max. période</th>
                <th>Max. examen</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.domain}</td>
                  <td>{s.period_max}</td>
                  <td>{s.exam_max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Les maxima restent modifiables dans les paramètres du bulletin.
        </p>
      </section>
    </>
  );
}
export function CommunicationsManager({
  school,
  students,
  classes,
  refresh,
}: {
  school: Row;
  students: Row[];
  classes: Row[];
  refresh: Refresh;
}) {
  const [audience, setAudience] = useState("school");
  return (
    <details className="panel form-panel">
      <summary>Publier une communication ciblée</summary>
      <ActionForm
        title="Nouvelle communication"
        label="Publier la communication"
        submit={async (f) => {
          await checked(
            db.from("web_messages").insert({
              school_id: school.id,
              title: f.title,
              body: f.body,
              audience,
              class_name: audience === "class" ? f.class_name : null,
              student_id: audience === "student" ? f.student_id : null,
            }),
          );
          await refresh();
        }}
      >
        <Input label="Titre" name="title" />
        <Select
          label="Destinataires"
          name="audience"
          value={audience}
          onChange={(e: any) => setAudience(e.target.value)}
          items={[
            { value: "school", label: "Toute l’école" },
            { value: "class", label: "Une classe" },
            { value: "student", label: "Un élève" },
          ]}
        />
        {audience === "class" && (
          <Select
            label="Classe destinataire"
            name="class_name"
            items={classes.map((c) => c.name)}
          />
        )}{" "}
        {audience === "student" && (
          <Select
            label="Élève destinataire"
            name="student_id"
            items={students
              .filter((s) => !s.archived)
              .map((s) => ({
                value: s.id,
                label: s.name + " · " + s.matricule,
              }))}
          />
        )}
        <label className="wide">
          Message
          <textarea name="body" rows={4} required />
        </label>
        <p className="muted">
          Le communiqué et sa notification seront visibles uniquement par les
          destinataires choisis.
        </p>
      </ActionForm>
    </details>
  );
}
export function Notifications({
  items,
  go,
  reads,
  refresh,
}: {
  items: Row[];
  go: (s: string) => void;
  reads: string[];
  refresh: Refresh;
}) {
  const [error, setError] = useState("");
  return (
    <section className="panel">
      <Feedback error={error} />
      <div className="panel-title">
        <h2>Mes notifications</h2>
        <span className="tag">
          {items.filter((n) => !reads.includes(n.id)).length} non lues
        </span>
      </div>
      {!items.length && <p>Aucune notification pour le moment.</p>}
      {[...items]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((n) => (
          <article
            className={"notification " + (reads.includes(n.id) ? "read" : "")}
            key={n.id}
          >
            <Bell size={18} />
            <div>
              <h3>{n.title}</h3>
              <p>{n.body}</p>
              <small>{new Date(n.created_at).toLocaleString("fr-FR")}</small>
            </div>
            <button
              className="button secondary"
              onClick={async () => {
                setError("");
                go(n.destination);
                try {
                  await checked(
                    db
                      .from("web_notification_reads")
                      .upsert(
                        { notification_id: n.id },
                        { onConflict: "user_id,notification_id" },
                      ),
                  );
                  await refresh();
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            >
              Consulter
            </button>
          </article>
        ))}
    </section>
  );
}
export function OnlinePayment() {
  return (
    <section className="panel coming-soon">
      <CreditCard size={42} />
      <span className="tag">Bientôt disponible</span>
      <h2>Le paiement en ligne arrive prochainement.</h2>
      <p>
        Votre école vous informera dès que ce service sera activé. En attendant,
        consultez vos paiements enregistrés ou contactez le secrétariat pour les
        moyens de paiement disponibles.
      </p>
    </section>
  );
}
export function GradeManager({
  school,
  classes,
  subjects,
  students,
  assignments,
  marks,
  refresh,
}: {
  school: Row;
  classes: Row[];
  subjects: Row[];
  students: Row[];
  assignments: Row[];
  marks: Row[];
  refresh: Refresh;
}) {
  const [selected, setSelected] = useState(""),
    [kind, setKind] = useState("devoir"),
    [preview, setPreview] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState("");
  const a = assignments.find((a) => a.id === selected),
    roster = students.filter(
      (s) => !s.archived && s.class_name === a?.class_name,
    ),
    graded = marks.filter((m) => m.assignment_id === a?.id),
    subject = subjects[0];
  async function upload(entries: Row[]) {
    await checked(db.rpc("web_import_marks", { assignment: a!.id, entries }));
    await refresh();
  }
  return (
    <>
      <Feedback error={error} notice={notice} />
      <details className="panel form-panel">
        <summary>Créer une évaluation</summary>
        {classes.length && subjects.length ? (
          <ActionForm
            title="Nouvelle évaluation — brouillon"
            label="Créer l’évaluation"
            submit={async (f) => {
              const rows = await checked(
                db
                  .from("web_assignments")
                  .insert({
                    school_id: school.id,
                    title: f.title,
                    class_name: f.class_name,
                    subject_id: f.subject_id,
                    kind,
                    term: Number(f.term),
                    period: kind === "examen" ? 0 : Number(f.period),
                    max_score: Number(f.max_score),
                    due_date: f.due_date,
                    published: false,
                  })
                  .select(),
              );
              await refresh();
              setSelected(rows[0].id);
            }}
          >
            <Input label="Intitulé" name="title" />
            <Select
              label="Type d’évaluation"
              name="kind"
              value={kind}
              onChange={(e: any) => setKind(e.target.value)}
              items={[
                { value: "devoir", label: "Devoir" },
                { value: "interrogation", label: "Interrogation" },
                { value: "examen", label: "Examen" },
                { value: "travail", label: "Travail / assignment" },
              ]}
            />
            <Select
              label="Classe"
              name="class_name"
              items={classes.map((c) => c.name)}
            />
            <Select
              label="Branche"
              name="subject_id"
              items={subjects.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(e: any) => {
                const max = e.target.form.elements.max_score;
                const s = subjects.find((s) => s.id === e.target.value);
                max.value = kind === "examen" ? s?.exam_max : s?.period_max;
              }}
            />
            <Input
              label="Trimestre"
              name="term"
              type="number"
              min={1}
              max={school.terms}
              value={1}
            />
            {kind !== "examen" && (
              <Input
                label="Période dans le trimestre"
                name="period"
                type="number"
                min={1}
                max={school.periods_per_term}
                value={1}
              />
            )}
            <Input
              key={kind}
              label="Maximum"
              name="max_score"
              type="number"
              min=".1"
              step=".1"
              value={
                kind === "examen" ? subject?.exam_max : subject?.period_max
              }
            />
            <Input label="Date de l’évaluation" name="due_date" type="date" />
            <p className="muted">
              Les notes sont enregistrées en brouillon. Publiez-les après
              vérification.
            </p>
          </ActionForm>
        ) : (
          <p>
            Créez au moins une classe et une branche avant d’ajouter une
            évaluation.
          </p>
        )}
      </details>
      <section className="panel">
        <div className="panel-title">
          <h2>Évaluations et publication</h2>
          <input
            className="compact-search"
            aria-label="Rechercher une évaluation"
            placeholder="Rechercher une évaluation…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label>
          Évaluation à gérer
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setPreview([]);
              setError("");
              setNotice("");
            }}
          >
            <option value="">Choisir une évaluation</option>
            {assignments
              .filter((a) =>
                (a.title + " " + a.class_name)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .sort((a, b) => b.due_date.localeCompare(a.due_date))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.published ? "Publiée" : "Brouillon"} · {a.class_name} · T
                  {a.term} · {a.title}
                </option>
              ))}
          </select>
        </label>
        {a && (
          <div className="grade-workspace">
            <h3>
              {a.title}{" "}
              <span className="tag">
                {a.kind} · / {a.max_score}
              </span>
            </h3>
            <p>
              {
                graded.filter((m) => roster.some((s) => s.id === m.student_id))
                  .length
              }{" "}
              note(s) enregistrée(s) pour {roster.length} élève(s).
            </p>
            <button
              className="button"
              disabled={busy}
              onClick={async () => {
                if (
                  !confirm(
                    a.published
                      ? "Masquer cette évaluation pour modifier ses notes ?"
                      : "Publier les notes enregistrées pour les élèves concernés et leurs notifications ?",
                  )
                )
                  return;
                setBusy(true);
                setError("");
                try {
                  await checked(
                    db
                      .from("web_assignments")
                      .update({ published: !a.published })
                      .eq("id", a.id)
                      .eq("school_id", school.id),
                  );
                  await refresh();
                  setNotice(
                    a.published
                      ? "Évaluation masquée."
                      : "Notes publiées : les élèves peuvent les consulter.",
                  );
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {a.published
                ? "Masquer pour modifier les notes"
                : "Publier les notes et notifier"}
            </button>
            {!a.published && (
              <>
                <div className="two-columns grade-inputs">
                  <ActionForm
                    title="Saisir une note"
                    label="Enregistrer la note"
                    submit={async (f) =>
                      upload([
                        { student_id: f.student_id, score: Number(f.score) },
                      ])
                    }
                  >
                    <Select
                      label="Élève à noter"
                      name="student_id"
                      items={roster.map((s) => ({
                        value: s.id,
                        label: s.name + " · " + s.matricule,
                      }))}
                    />
                    <Input
                      label="Note obtenue"
                      name="score"
                      type="number"
                      min={0}
                      max={a.max_score}
                      step=".1"
                    />
                  </ActionForm>
                  <div>
                    <h3>Importer les notes depuis Excel</h3>
                    <p className="muted">
                      Colonnes : Matricule et Note. Les lignes sans note sont
                      ignorées. Les notes existantes de cette évaluation seront
                      remplacées pour les élèves présents dans le fichier.
                    </p>
                    <button
                      className="button secondary"
                      onClick={() =>
                        downloadWorkbook(
                          "modele-notes.xlsx",
                          roster.map((s) => ({
                            Matricule: s.matricule,
                            Nom: s.name,
                            Note: "",
                          })),
                        )
                      }
                    >
                      <Download size={16} />
                      Modèle Excel notes
                    </button>
                    <label className="upload-label">
                      Choisir le fichier notes
                      <input
                        type="file"
                        disabled={busy}
                        accept=".xlsx,.xls,.csv"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setError("");
                          setPreview([]);
                          try {
                            const result = validateMarks(
                              await readWorkbook(file),
                              roster as any,
                              a.max_score,
                            );
                            if (!result.length)
                              throw Error("Aucune note renseignée.");
                            setPreview(result);
                          } catch (err) {
                            setError((err as Error).message);
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
                {preview.length > 0 && (
                  <div className="import-preview">
                    <h3>Aperçu des notes</h3>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Matricule</th>
                            <th>Note</th>
                            <th>Validation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.map((r, i) => (
                            <tr key={i}>
                              <td>{r.matricule}</td>
                              <td>{r.note}</td>
                              <td>{r.errors.join(" · ") || "Prêt"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      className="button"
                      disabled={busy || preview.some((r) => r.errors.length)}
                      onClick={async () => {
                        setBusy(true);
                        setError("");
                        try {
                          await upload(
                            preview.map((r) => ({
                              student_id: r.student_id,
                              score: r.score,
                            })),
                          );
                          setNotice(
                            preview.length +
                              " note(s) importée(s) en brouillon.",
                          );
                          setPreview([]);
                        } catch (err) {
                          setError((err as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Confirmer l’import des notes
                    </button>
                  </div>
                )}
              </>
            )}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Élève</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((s) => (
                    <tr key={s.id}>
                      <td>{s.matricule}</td>
                      <td>{s.name}</td>
                      <td>
                        {graded.find((m) => m.student_id === s.id)?.score ??
                          "—"}{" "}
                        / {a.max_score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
