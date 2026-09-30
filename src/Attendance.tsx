import { schoolRows } from "./school-data";
import { useEffect, useState } from "react";
import { db } from "./client";
import { checked } from "./management";
import { readWorkbook, downloadWorkbook } from "./imports";
import { attendanceLabels, validateAttendance } from "./school-operations";
type Row = Record<string, any>;
const today = () => new Date().toLocaleDateString("en-CA");
export function Attendance({
  school,
  students,
  classes,
  canEdit,
}: {
  school: Row;
  students: Row[];
  classes: Row[];
  canEdit: boolean;
}) {
  const [kind, setKind] = useState<"student" | "worker">("student"),
    [day, setDay] = useState(today),
    [className, setClassName] = useState(classes[0]?.name || "");
  const [workers, setWorkers] = useState<Row[]>([]),
    [records, setRecords] = useState<Row[]>([]),
    [draft, setDraft] = useState<
      Record<string, { status: string; note: string }>
    >({}),
    [preview, setPreview] = useState<ReturnType<typeof validateAttendance>>([]);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    void schoolRows("web_workers", school.id)
      .then((rows) => {
        if (alive) setWorkers(rows);
      })
      .catch(() => {
        if (alive) setError("Chargement du personnel impossible.");
      });
    return () => {
      alive = false;
    };
  }, [school.id]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setDraft({});
    setPreview([]);
    setNotice("");
    setError("");
    void schoolRows("web_" + kind + "_attendance", school.id, {
      attended_on: day,
    })
      .then((rows) => {
        if (alive) {
          setLoading(false);
          setRecords(rows);
        }
      })
      .catch(() => {
        if (alive) {
          setLoading(false);
          setRecords([]);
          setError("Chargement des présences impossible.");
        }
      });
    return () => {
      alive = false;
    };
  }, [school.id, kind, day, className]);
  const people =
    kind === "student"
      ? students.filter((s) => !s.archived && s.class_name === className)
      : workers.filter((w) => w.active);
  async function save(entries: Row[]) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await checked(
        db.rpc("web_save_attendance", {
          sid: school.id,
          kind,
          day,
          entries,
          class_filter: kind === "student" ? className : null,
        }),
      );
      const data = await schoolRows("web_" + kind + "_attendance", school.id, {
        attended_on: day,
      });
      setRecords(data);
      setDraft({});
      setPreview([]);
      setNotice(entries.length + " présence(s) enregistrée(s).");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const dirty = Object.entries(draft)
    .filter(([, v]) => v.status)
    .map(([person_id, v]) => ({ person_id, ...v }));
  return (
    <section>
      <div className="panel toolbar">
        <label>
          Registre
          <select
            disabled={busy}
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="student">Élèves</option>
            <option value="worker">Personnel</option>
          </select>
        </label>
        <label>
          Date
          <input
            required
            disabled={busy}
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        {kind === "student" && (
          <label>
            Classe
            <select
              disabled={busy}
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            >
              {classes.map((c) => (
                <option key={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {!canEdit && (
        <p>
          Consultation uniquement. Le sous-administrateur enregistre les
          présences.
        </p>
      )}
      {canEdit && (
        <details className="panel">
          <summary>Importer les présences depuis Excel</summary>
          <p>
            Choisissez la date et la classe, téléchargez le modèle et renseignez
            chaque statut. Une case vide ne signifie pas « présent ». L’import
            remplace les présences existantes pour les personnes et la date
            indiquées.
          </p>
          <button
            className="button secondary"
            disabled={!people.length || busy}
            onClick={() =>
              void downloadWorkbook(
                "modele-presences.xlsx",
                people.map((p) => ({
                  [kind === "student" ? "Matricule" : "Identifiant"]:
                    kind === "student" ? p.matricule : p.id,
                  Nom: p.name,
                  Statut: "",
                  Observation: "",
                })),
              )
            }
          >
            Télécharger le modèle Excel
          </button>
          <label>
            Fichier Excel
            <input
              disabled={busy || loading}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setError("");
                setPreview([]);
                setBusy(true);
                try {
                  setPreview(
                    validateAttendance(
                      await readWorkbook(file),
                      people as any,
                      kind,
                    ),
                  );
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
          {!!preview.length && (
            <>
              <h3>
                Aperçu · {day} · {kind === "student" ? className : "Personnel"}
              </h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Ligne</th>
                      <th>Nom</th>
                      <th>Statut</th>
                      <th>Vérification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((p) => (
                      <tr key={p.line}>
                        <td>{p.line}</td>
                        <td>{p.name}</td>
                        <td>{attendanceLabels[p.status]}</td>
                        <td>{p.errors.join(" · ") || "Valide"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="button"
                disabled={
                  busy || !day || preview.some((p) => p.errors.length > 0)
                }
                onClick={() =>
                  void save(
                    preview.map(({ person_id, status, note }) => ({
                      person_id,
                      status,
                      note,
                    })),
                  )
                }
              >
                Confirmer l’import ({preview.length})
              </button>
            </>
          )}
        </details>
      )}
      <section className="panel">
        <h2>Feuille de présence · {day}</h2>
        {loading ? (
          <p>Chargement…</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Statut</th>
                  <th>Observation</th>
                  <th>Dernière modification</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => {
                  const record = records.find((r) => r.person_id === p.id),
                    v = draft[p.id] || {
                      status: record?.status || "",
                      note: record?.note || "",
                    };
                  return (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>
                        {canEdit ? (
                          <select
                            aria-label={"Présence de " + p.name}
                            disabled={busy}
                            value={v.status}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                [p.id]: { ...v, status: e.target.value },
                              }))
                            }
                          >
                            <option value="">Non renseigné</option>
                            {Object.entries(attendanceLabels).map(
                              ([k, label]) => (
                                <option key={k} value={k}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        ) : (
                          attendanceLabels[v.status] || "Non renseigné"
                        )}
                      </td>
                      <td>
                        {canEdit ? (
                          <input
                            aria-label={"Observation de " + p.name}
                            disabled={busy}
                            value={v.note}
                            maxLength={500}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                [p.id]: { ...v, note: e.target.value },
                              }))
                            }
                          />
                        ) : (
                          v.note || "—"
                        )}
                      </td>
                      <td>
                        {record
                          ? new Date(record.updated_at).toLocaleString("fr-FR")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!people.length && <p>Aucune personne dans cette sélection.</p>}
          </div>
        )}
        {canEdit && (
          <button
            className="button"
            disabled={busy || loading || !dirty.length || !day}
            onClick={() => void save(dirty)}
          >
            Enregistrer les modifications ({dirty.length})
          </button>
        )}
      </section>
    </section>
  );
}
