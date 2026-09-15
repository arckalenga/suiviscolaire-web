import { Bulletin } from "./Bulletin";
import {
  useEffect,
  useState,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  BookOpen,
  Wallet,
  MessageSquare,
  CalendarDays,
  Settings,
  LogOut,
  ArrowLeft,
  ArrowRight,
  Printer,
  Download,
  Check,
  School,
  ChevronRight,
  Bell,
  CreditCard,
} from "lucide-react";
import { db } from "./client";
import "./style.css";
import "./acadexis.css";
import "./refinements.css";
import { slug } from "../supabase/functions/web-manage-accounts/student-access.ts";
import { Landing } from "./Landing";
import {
  MainControls,
  StudentActions,
  StudentsManager,
  ClassManager,
  GradeManager,
  CommunicationsManager,
  Notifications,
  OnlinePayment,
} from "./management";
type Row = Record<string, any>;
type Data = {
  students: Row[];
  subjects: Row[];
  assignments: Row[];
  marks: Row[];
  payments: Row[];
  messages: Row[];
  timetable: Row[];
  classes: Row[];
  notifications: Row[];
};
const empty: Data = {
  students: [],
  subjects: [],
  assignments: [],
  marks: [],
  payments: [],
  messages: [],
  timetable: [],
  classes: [],
  notifications: [],
};
const money = (n: number, c: string) =>
  new Intl.NumberFormat("fr-CD", {
    style: "currency",
    currency: c,
    maximumFractionDigits: c === "CDF" ? 0 : 2,
  }).format(n);
const date = (s: string) =>
  new Intl.DateTimeFormat("fr-FR").format(new Date(s + "T12:00:00"));
const nav = [
  ["overview", "Vue d’ensemble", LayoutDashboard],
  ["students", "Élèves", Users],
  ["classes", "Classes & cours", GraduationCap],
  ["marks", "Notes & devoirs", BookOpen],
  ["bulletin", "Bulletins", GraduationCap],
  ["payments", "Paiements", Wallet],
  ["messages", "Communications", MessageSquare],
  ["timetable", "Emploi du temps", CalendarDays],
  ["notifications", "Notifications", Bell],
  ["online", "Payer en ligne", CreditCard],
  ["settings", "Paramètres", Settings],
] as const;
function App() {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [schools, setSchools] = useState<Row[]>([]),
    [members, setMembers] = useState<Row[]>([]),
    [main, setMain] = useState(false),
    [selected, setSelected] = useState<Row | null>(null),
    [tab, setTab] = useState("overview"),
    [data, setData] = useState<Data>(empty),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [studentId, setStudentId] = useState("");
  const [publicPage, setPublicPage] = useState(
    window.location.hash === "#connexion" ? "login" : "home",
  );
  const [pdfBusy, setPdfBusy] = useState(false);
  const [reads, setReads] = useState<string[]>([]);
  useEffect(() => {
    const change = () =>
      setPublicPage(window.location.hash === "#connexion" ? "login" : "home");
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const requestId = useRef(0);
  const selectedScope = useRef<string | null>(null);
  const sessionScope = useRef<string | null>(null);
  selectedScope.current = selected?.id || null;
  sessionScope.current = session?.user.id || null;
  const isStaff =
    main || members.some((m) => m.role === "subadmin" && m.active);
  const manager =
    main ||
    members.some(
      (m) => m.school_id === selected?.id && m.role === "subadmin" && m.active,
    );
  useEffect(() => {
    db.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setSchools([]);
        setSelected(null);
        setData(empty);
        setReads([]);
        setTab("overview");
        setMain(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session) void loadSchools();
  }, [session?.user.id]);
  async function loadSchools() {
    if (!session) return;
    const userId = session.user.id;
    setBusy(true);
    setError("");
    const [s, m, a] = await Promise.all([
      db.from("web_schools").select("*").order("name"),
      db.from("web_memberships").select("*").eq("user_id", session!.user.id),
      db.from("web_admins").select("*").eq("user_id", session!.user.id),
    ]);
    if (sessionScope.current !== userId) return;
    if (s.error || m.error || a.error)
      setError("Impossible de charger les établissements. Réessayez.");
    else {
      setSchools(s.data || []);
      setMembers(m.data || []);
      setMain(!!a.data?.length);
      if (
        s.data?.length === 1 &&
        !a.data?.length &&
        m.data?.some((x) => x.role === "student")
      )
        setSelected(s.data[0]);
    }
    setBusy(false);
  }
  useEffect(() => {
    if (selected) void loadData();
    return () => {
      requestId.current++;
    };
  }, [selected?.id]);
  async function loadData(refresh = false) {
    if (!selected || selectedScope.current !== selected.id) return;
    const currentRequest = ++requestId.current;
    if (!refresh) {
      setBusy(true);
      setData(empty);
    }
    setError("");
    try {
      const keys = Object.keys(empty) as (keyof Data)[];
      const result = await Promise.all(
        keys.map(async (key) => {
          const rows: Row[] = [];
          for (let offset = 0; ; offset += 1000) {
            const r = await db
              .from("web_" + key)
              .select("*")
              .eq("school_id", selected.id)
              .order("id")
              .range(offset, offset + 999);
            if (r.error) throw r.error;
            rows.push(...r.data);
            if (r.data.length < 1000) break;
          }
          return rows;
        }),
      );
      const readResult = await db
        .from("web_notification_reads")
        .select("notification_id")
        .limit(10000);
      if (readResult.error) throw readResult.error;
      if (
        currentRequest !== requestId.current ||
        selectedScope.current !== selected.id
      )
        return;
      const next = Object.fromEntries(
        keys.map((k, i) => [k, result[i]]),
      ) as Data;
      next.subjects.sort((a, b) => a.sort_order - b.sort_order);
      setData(next);
      setReads((readResult.data || []).map((r) => r.notification_id));
      setStudentId((id) =>
        next.students.some((s) => s.id === id)
          ? id
          : next.students.find((s) => !s.archived)?.id || "",
      );
    } catch {
      if (currentRequest === requestId.current)
        setError("Impossible de charger les informations. Réessayez.");
    } finally {
      if (currentRequest === requestId.current) setBusy(false);
    }
  }
  async function refreshReads() {
    const r = await db
      .from("web_notification_reads")
      .select("notification_id")
      .limit(10000);
    if (!r.error) setReads((r.data || []).map((x) => x.notification_id));
  }
  async function mutate(table: string, values: Row, id?: string) {
    setError("");
    setNotice("");
    const q = id
      ? db.from(table).update(values).eq("id", id).select()
      : db.from(table).insert(values).select();
    const { data: rows, error: e } = await q;
    if (e || !rows?.length) {
      setError(
        "Enregistrement refusé. Vérifiez les valeurs et vos droits d’accès.",
      );
      return false;
    }
    setNotice("Les modifications ont été enregistrées.");
    await loadData();
    return true;
  }
  if (!ready) return <div className="loading">Ouverture de SuiviScolaire…</div>;
  if (!session)
    return publicPage === "login" ? (
      <>
        <button
          className="return-home"
          onClick={() => {
            window.location.hash = "accueil";
            setPublicPage("home");
            setError("");
          }}
        >
          ← Retour à l’accueil
        </button>
        <Login onError={setError} error={error} />
      </>
    ) : (
      <Landing
        login={() => {
          window.location.hash = "connexion";
          setPublicPage("login");
          setError("");
        }}
      />
    );
  const student = data.students.find((s) => s.id === studentId);
  const ownMarks = data.marks.filter((m) => m.student_id === studentId);
  const assigned = data.assignments.filter(
    (a) => a.class_name === student?.class_name && a.published,
  );
  const marked = assigned.filter((a) =>
    ownMarks.some((m) => m.assignment_id === a.id),
  );
  const total = marked.reduce((sum, a) => sum + a.max_score, 0);
  const earned = ownMarks
    .filter((m) => marked.some((a) => a.id === m.assignment_id))
    .reduce((sum, m) => sum + Number(m.score), 0);
  const average = total ? ((earned / total) * 100).toFixed(1) : "—";
  const go = (next: string) => {
    setTab(next);
    setNotice("");
    setError("");
  };
  function StudentPicker() {
    return manager ? (
      <label className="inline-label">
        Élève
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          {data.students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.class_name}
            </option>
          ))}
        </select>
      </label>
    ) : null;
  }
  return (
    <div className="app">
      <aside className="sidebar no-print">
        <a className="brand" href="#/" onClick={() => go("overview")}>
          <span className="brand-icon">
            <GraduationCap />
          </span>
          <span>
            Suivi<span className="blue">Scolaire</span>
            <small>VOTRE ÉCOLE, SIMPLEMENT</small>
          </span>
        </a>
        <div className="role-label">
          {main
            ? "ADMINISTRATION PRINCIPALE"
            : isStaff
              ? "ADMINISTRATION SCOLAIRE"
              : "ESPACE ÉLÈVE"}
        </div>
        <button
          className={"school-switch " + (!selected ? "active" : "")}
          onClick={() => {
            setSelected(null);
            setData(empty);
            go("overview");
          }}
        >
          <School size={20} />
          <span>
            {selected?.name || "Tous les établissements"}
            <small>{selected?.city || "Réseau scolaire"}</small>
          </span>
          <ChevronRight size={16} />
        </button>
        <nav>
          {selected &&
            nav
              .filter(
                ([id]) =>
                  manager || !["students", "classes", "settings"].includes(id),
              )
              .map(([id, label, Icon]) => (
                <button
                  className={tab === id ? "active" : ""}
                  key={id}
                  onClick={() => go(id)}
                >
                  <Icon size={19} />
                  {label}
                </button>
              ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-label">
            <span /> Démonstration · données fictives
          </div>
          <div className="account">
            <span className="avatar">
              {main ? "AP" : isStaff ? "SA" : "ÉL"}
            </span>
            <span>
              <strong>
                {main
                  ? "Administrateur"
                  : isStaff
                    ? "Sous-administrateur"
                    : "Élève"}
              </strong>
              <small>{session.user.email}</small>
            </span>
          </div>
          <button
            className="logout"
            onClick={async () => {
              await db.auth.signOut({ scope: "local" });
              setSelected(null);
              setData(empty);
            }}
          >
            <LogOut size={17} />
            Se déconnecter
          </button>
        </div>
      </aside>
      <main>
        <header className="topbar no-print">
          <span>
            Espace scolaire <ChevronRight size={14} />{" "}
            {selected?.name || "Établissements"}
          </span>
          <span className="year">{selected?.academic_year || "2025–2026"}</span>
        </header>
        <div className="content">
          {error && (
            <div role="alert" className="alert">
              {error}
              <button onClick={() => (selected ? loadData() : loadSchools())}>
                Réessayer
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              <Check size={18} />
              {notice}
            </div>
          )}
          {!selected ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">VOTRE RÉSEAU SCOLAIRE</div>
                  <h1>Vos établissements</h1>
                  <p>
                    Choisissez une école pour retrouver son espace de travail.
                  </p>
                </div>
                <span className="count">{schools.length} établissements</span>
              </div>
              {main && <MainControls schools={schools} refresh={loadSchools} />}
              <div className="welcome">
                <div>
                  <span className="pill">Une vue claire, chaque jour</span>
                  <h2>
                    Tout commence par
                    <br />
                    la bonne école.
                  </h2>
                  <p>
                    Élèves, résultats et vie scolaire :<br />
                    vos informations réunies dans un seul espace.
                  </p>
                </div>
                <GraduationCap size={150} strokeWidth={1} />
              </div>
              <div className="school-grid">
                {schools.map((s, i) => (
                  <button
                    className="school-card"
                    key={s.id}
                    onClick={() => {
                      setSelected(s);
                      go("overview");
                    }}
                  >
                    <div className={"school-art art-" + i}>
                      <School size={48} />
                      <span>0{i + 1}</span>
                    </div>
                    <div className="school-card-body">
                      <span className="tag">{s.city}</span>
                      <h2>{s.name}</h2>
                      <p>
                        Année scolaire {s.academic_year} · {s.currency}
                      </p>
                      <span className="school-open">
                        Ouvrir l’établissement <ArrowRight size={18} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {!schools.length && !busy && (
                <Empty text="Aucun établissement ne vous est attribué. Contactez l’administrateur." />
              )}
            </>
          ) : (
            <>
              <div className="page-heading no-print">
                <div>
                  <div className="eyebrow">
                    {selected.city} ·{" "}
                    {manager
                      ? "GESTION DE L’ÉTABLISSEMENT"
                      : "MON ESPACE PERSONNEL"}
                  </div>
                  <h1>{nav.find((n) => n[0] === tab)?.[1]}</h1>
                  <p>
                    {tab === "overview"
                      ? manager
                        ? "L’essentiel de votre école, en un coup d’œil."
                        : "Bonjour " +
                          (student?.name || "") +
                          ". Voici votre vie scolaire."
                      : selected.name}
                  </p>
                </div>
                {tab !== "overview" && (
                  <button
                    className="button secondary"
                    onClick={() => go("overview")}
                  >
                    <ArrowLeft size={16} /> Vue d’ensemble
                  </button>
                )}
              </div>
              {busy ? (
                <div className="loading">Chargement des informations…</div>
              ) : (
                <>
                  {tab === "overview" && (
                    <>
                      {!manager && (
                        <StudentActions
                          go={go}
                          unread={
                            data.notifications.filter(
                              (n) => !reads.includes(n.id),
                            ).length
                          }
                        />
                      )}
                      <div className="stats">
                        <Stat
                          label={manager ? "Élèves inscrits" : "Ma classe"}
                          value={
                            manager
                              ? data.students.filter((s) => !s.archived).length
                              : student?.class_name || "—"
                          }
                          icon={<Users />}
                        />
                        <Stat
                          label={
                            manager
                              ? "Branches enseignées"
                              : "Moyenne des notes publiées"
                          }
                          value={
                            manager ? data.subjects.length : average + " %"
                          }
                          icon={<BookOpen />}
                        />
                        <Stat
                          label="Devoirs publiés"
                          value={
                            data.assignments.filter((a) => a.published).length
                          }
                          icon={<GraduationCap />}
                        />
                        <Stat
                          label="Communications"
                          value={data.messages.length}
                          icon={<MessageSquare />}
                        />
                      </div>
                      <div className="two-columns">
                        {manager && (
                          <section className="panel">
                            <div className="panel-title">
                              <h2>Votre quotidien</h2>
                              <span className="tag">Accès rapide</span>
                            </div>
                            <div className="quick-grid">
                              {[
                                [
                                  "marks",
                                  "Consulter les notes",
                                  "Devoirs et évaluations",
                                  BookOpen,
                                ],
                                [
                                  "bulletin",
                                  "Ouvrir un bulletin",
                                  "Résultats par trimestre",
                                  GraduationCap,
                                ],
                                [
                                  "payments",
                                  "Suivre les paiements",
                                  "Historique en CDF et USD",
                                  Wallet,
                                ],
                                [
                                  "timetable",
                                  "Voir les cours",
                                  "Le programme de la semaine",
                                  CalendarDays,
                                ],
                              ].map(([id, title, sub, Icon]: any) => (
                                <button
                                  className="quick"
                                  key={id}
                                  onClick={() => go(id)}
                                >
                                  <Icon />
                                  <strong>{title}</strong>
                                  <small>{sub}</small>
                                  <ArrowRight size={16} />
                                </button>
                              ))}
                            </div>
                          </section>
                        )}
                        <section className="panel">
                          <div className="panel-title">
                            <h2>À la une</h2>
                            <button
                              className="text-button"
                              onClick={() => go("messages")}
                            >
                              Tout voir
                            </button>
                          </div>
                          {data.messages.slice(0, 3).map((m) => (
                            <article className="message-preview" key={m.id}>
                              <span className="message-icon">
                                <MessageSquare size={18} />
                              </span>
                              <div>
                                <h3>{m.title}</h3>
                                <p>{m.body}</p>
                              </div>
                            </article>
                          ))}
                        </section>
                      </div>
                    </>
                  )}
                  {tab === "students" && manager && (
                    <StudentsManager
                      school={selected}
                      students={data.students}
                      classes={data.classes}
                      refresh={() => loadData(true)}
                      view={(id) => {
                        setStudentId(id);
                        go("bulletin");
                      }}
                    />
                  )}
                  {tab === "classes" && manager && (
                    <ClassManager
                      school={selected}
                      classes={data.classes}
                      subjects={data.subjects}
                      refresh={() => loadData(true)}
                    />
                  )}
                  {tab === "marks" &&
                    (manager ? (
                      <GradeManager
                        school={selected}
                        classes={data.classes}
                        subjects={data.subjects}
                        students={data.students}
                        assignments={data.assignments}
                        marks={data.marks}
                        refresh={() => loadData(true)}
                      />
                    ) : (
                      <section className="panel">
                        <div className="panel-title">
                          <h2>Mes notes</h2>
                          <span className="tag">{average} %</span>
                        </div>
                        <Table
                          headers={[
                            "Évaluation",
                            "Type",
                            "Trimestre",
                            "Date",
                            "Note",
                          ]}
                        >
                          {data.assignments
                            .filter((a) => a.class_name === student?.class_name)
                            .sort((a, b) =>
                              b.due_date.localeCompare(a.due_date),
                            )
                            .map((a) => {
                              const m = ownMarks.find(
                                (m) => m.assignment_id === a.id,
                              );
                              return (
                                <tr key={a.id}>
                                  <td>
                                    <strong>{a.title}</strong>
                                  </td>
                                  <td>{a.kind}</td>
                                  <td>T{a.term}</td>
                                  <td>{date(a.due_date)}</td>
                                  <td>
                                    <span className="score">
                                      {m ? m.score : "—"}{" "}
                                      <small>/ {a.max_score}</small>
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                        </Table>
                      </section>
                    ))}
                  {tab === "notifications" && (
                    <Notifications
                      items={data.notifications}
                      reads={reads}
                      go={go}
                      refresh={refreshReads}
                    />
                  )}
                  {tab === "online" && <OnlinePayment />}
                  {tab === "bulletin" && (
                    <>
                      <div className="toolbar no-print">
                        <StudentPicker />
                        <button
                          className="button"
                          disabled={!student || pdfBusy}
                          onClick={async () => {
                            const report =
                              document.querySelector<HTMLElement>(".bulletin");
                            if (!report || !student) return;
                            const snapshot = report.cloneNode(
                              true,
                            ) as HTMLElement;
                            const filename =
                              (
                                "bulletin-" +
                                student.name +
                                "-" +
                                selected.academic_year
                              ).replace(/[^a-zA-Z0-9À-ÿ._-]/g, "-") + ".pdf";
                            setPdfBusy(true);
                            try {
                              const { downloadBulletinPdf } =
                                await import("./bulletin-pdf");
                              await downloadBulletinPdf(snapshot, filename);
                            } catch {
                              setError(
                                "Le téléchargement du bulletin a échoué. Réessayez ou utilisez Imprimer.",
                              );
                            } finally {
                              setPdfBusy(false);
                            }
                          }}
                        >
                          <Download size={17} />{" "}
                          {pdfBusy
                            ? "Préparation du PDF…"
                            : "Télécharger le PDF"}
                        </button>
                        <button
                          className="button secondary"
                          disabled={!student}
                          onClick={() => window.print()}
                        >
                          <Printer size={17} /> Imprimer
                        </button>
                      </div>
                      {student ? (
                        <Bulletin
                          school={selected}
                          student={student}
                          data={data}
                        />
                      ) : (
                        <Empty text="Aucun élève disponible." />
                      )}
                    </>
                  )}
                  {tab === "payments" && (
                    <>
                      <StudentPicker />
                      {manager && (
                        <details className="panel form-panel">
                          <summary>Enregistrer un paiement reçu</summary>
                          <Form
                            title={"Paiement · " + student?.name}
                            onSubmit={async (f) =>
                              mutate("web_payments", {
                                school_id: selected.id,
                                student_id: studentId,
                                label: f.label,
                                amount: Number(f.amount),
                                currency: f.currency,
                                paid_on: f.paid_on,
                                reference: f.reference,
                              })
                            }
                          >
                            <Field label="Libellé" name="label" />
                            <Field
                              label="Montant"
                              name="amount"
                              type="number"
                              min=".01"
                              step=".01"
                            />
                            <label>
                              Devise
                              <select
                                name="currency"
                                defaultValue={selected.currency}
                              >
                                <option>CDF</option>
                                <option>USD</option>
                              </select>
                            </label>
                            <Field
                              label="Date du paiement"
                              name="paid_on"
                              type="date"
                            />
                            <Field label="Référence du reçu" name="reference" />
                          </Form>
                        </details>
                      )}
                      <section className="panel">
                        <div className="panel-title">
                          <h2>Historique des paiements</h2>
                          <span className="tag">
                            Paiements enregistrés par l’école
                          </span>
                        </div>
                        <p className="muted">
                          Cet espace affiche les paiements reçus. Le paiement en
                          ligne n’est pas encore activé.
                        </p>
                        <Table
                          headers={["Date", "Libellé", "Référence", "Montant"]}
                        >
                          {data.payments
                            .filter((p) => p.student_id === studentId)
                            .sort((a, b) => b.paid_on.localeCompare(a.paid_on))
                            .map((p) => (
                              <tr key={p.id}>
                                <td>{date(p.paid_on)}</td>
                                <td>{p.label}</td>
                                <td>{p.reference}</td>
                                <td>
                                  <strong>{money(p.amount, p.currency)}</strong>
                                </td>
                              </tr>
                            ))}
                        </Table>
                      </section>
                    </>
                  )}
                  {tab === "messages" && (
                    <>
                      {manager && (
                        <CommunicationsManager
                          school={selected}
                          students={data.students}
                          classes={data.classes}
                          refresh={() => loadData(true)}
                        />
                      )}
                      <div className="message-list">
                        {data.messages
                          .sort((a, b) =>
                            b.created_at.localeCompare(a.created_at),
                          )
                          .map((m) => (
                            <article key={m.id} className="panel">
                              <div className="eyebrow">
                                DIRECTION ·{" "}
                                {new Date(m.created_at).toLocaleDateString(
                                  "fr-FR",
                                )}
                              </div>
                              {manager && (
                                <span className="tag">
                                  {m.audience === "class"
                                    ? "Classe : " + m.class_name
                                    : m.audience === "student"
                                      ? "Élève : " +
                                        (data.students.find(
                                          (s) => s.id === m.student_id,
                                        )?.name || "Élève")
                                      : "Toute l’école"}
                                </span>
                              )}
                              <h2>{m.title}</h2>
                              <p className="message-body">{m.body}</p>
                            </article>
                          ))}
                      </div>
                    </>
                  )}
                  {tab === "timetable" && (
                    <>
                      {manager && (
                        <details className="panel form-panel">
                          <summary>Ajouter un cours à l’horaire</summary>
                          <Form
                            title="Nouveau créneau"
                            onSubmit={async (f) =>
                              mutate("web_timetable", {
                                school_id: selected.id,
                                class_name: f.class_name,
                                day: Number(f.day),
                                starts_at: f.starts_at,
                                ends_at: f.ends_at,
                                subject: f.subject,
                                teacher: f.teacher,
                              })
                            }
                          >
                            <Field
                              label="Classe"
                              name="class_name"
                              value="1ère primaire"
                            />
                            <label>
                              Jour
                              <select name="day">
                                {[
                                  "Lundi",
                                  "Mardi",
                                  "Mercredi",
                                  "Jeudi",
                                  "Vendredi",
                                ].map((d, i) => (
                                  <option value={i + 1} key={d}>
                                    {d}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <Field label="Début" name="starts_at" type="time" />
                            <Field label="Fin" name="ends_at" type="time" />
                            <Field label="Matière" name="subject" />
                            <Field label="Enseignant" name="teacher" />
                          </Form>
                        </details>
                      )}
                      <div className="timetable">
                        {[
                          "Lundi",
                          "Mardi",
                          "Mercredi",
                          "Jeudi",
                          "Vendredi",
                        ].map((day, i) => (
                          <section className="day" key={day}>
                            <h2>{day}</h2>
                            {data.timetable
                              .filter((t) => t.day === i + 1)
                              .sort((a, b) =>
                                a.starts_at.localeCompare(b.starts_at),
                              )
                              .map((t) => (
                                <article key={t.id}>
                                  <small>
                                    {t.starts_at.slice(0, 5)} –{" "}
                                    {t.ends_at.slice(0, 5)}
                                  </small>
                                  <h3>{t.subject}</h3>
                                  <p>{t.teacher}</p>
                                  <span>{t.class_name}</span>
                                </article>
                              ))}
                          </section>
                        ))}
                      </div>
                    </>
                  )}
                  {tab === "settings" && manager && (
                    <>
                      <section className="panel">
                        <Form
                          title="Établissement et calendrier"
                          onSubmit={async (f) => {
                            const values = {
                              name: f.name,
                              city: f.city,
                              currency: f.currency,
                              student_email_domain: String(
                                f.student_email_domain,
                              )
                                .trim()
                                .toLowerCase(),
                              terms: Number(f.terms),
                              periods_per_term: Number(f.periods_per_term),
                            };
                            const ok = await mutate(
                              "web_schools",
                              values,
                              selected.id,
                            );
                            if (ok) {
                              setSelected({ ...selected, ...values });
                              setSchools(
                                schools.map((s) =>
                                  s.id === selected.id
                                    ? { ...s, ...values }
                                    : s,
                                ),
                              );
                            }
                            return ok;
                          }}
                        >
                          <Field
                            label="Nom"
                            name="name"
                            value={selected.name}
                          />
                          <Field
                            label="Ville"
                            name="city"
                            value={selected.city}
                          />
                          <label>
                            Domaine des identifiants élèves
                            <input
                              name="student_email_domain"
                              required
                              maxLength={190}
                              defaultValue={
                                selected.student_email_domain ||
                                (slug(selected.name) || "ecole") + ".com"
                              }
                              placeholder="csfleuve.com"
                            />
                            <small className="field-help">
                              Exemple : kalenga@csfleuve.com. S’applique aux
                              nouveaux comptes. Aucune boîte e-mail n’est créée.
                            </small>
                          </label>
                          <label>
                            Devise par défaut
                            <select
                              name="currency"
                              defaultValue={selected.currency}
                            >
                              <option>CDF</option>
                              <option>USD</option>
                            </select>
                          </label>
                          <Field
                            label="Nombre de trimestres"
                            name="terms"
                            type="number"
                            value={selected.terms}
                            min={1}
                            max={4}
                          />
                          <Field
                            label="Périodes par trimestre"
                            name="periods_per_term"
                            type="number"
                            value={selected.periods_per_term}
                            min={1}
                            max={4}
                          />
                          <p className="muted">
                            Le modèle RDC utilise 3 trimestres et 2 périodes par
                            trimestre. Les paiements existants conservent leur
                            devise. Les maxima des devoirs déjà créés sont
                            conservés.
                          </p>
                        </Form>
                      </section>
                      <section className="panel">
                        <h2>Maxima des branches</h2>
                        <p className="muted">
                          Référence pour les prochains devoirs. Les notes
                          existantes ne sont pas recalculées.
                        </p>
                        {data.subjects.map((s) => (
                          <SubjectEditor key={s.id} subject={s} save={mutate} />
                        ))}
                      </section>
                    </>
                  )}
                </>
              )}
            </>
          )}
          <footer className="no-print">
            SuiviScolaire <span>·</span> Un espace pour apprendre, un outil pour
            accompagner.
          </footer>
        </div>
      </main>
    </div>
  );
}
function Login({
  error,
  onError,
}: {
  error: string;
  onError: (s: string) => void;
}) {
  const [waiting, setWaiting] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWaiting(true);
    onError("");
    const f = new FormData(e.currentTarget);
    const { error } = await db.auth.signInWithPassword({
      email: String(f.get("email")).trim(),
      password: String(f.get("password")),
    });
    if (error)
      onError(
        "Connexion impossible. Vérifiez votre adresse et votre mot de passe.",
      );
    setWaiting(false);
  }
  return (
    <div className="login">
      <section className="login-story">
        <div className="brand">
          <GraduationCap size={34} />
          SuiviScolaire
        </div>
        <div>
          <div className="eyebrow">ENSEMBLE, POUR LA RÉUSSITE</div>
          <h1>
            L’école.
            <br />
            Plus proche.
            <br />
            <span>Plus simple.</span>
          </h1>
          <p>
            Un espace commun pour suivre les progrès,
            <br />
            organiser le quotidien et rester en lien.
          </p>
          <div className="login-features">
            <span>
              <Check size={16} /> Résultats scolaires
            </span>
            <span>
              <Check size={16} /> Vie de l’école
            </span>
            <span>
              <Check size={16} /> Suivi des paiements
            </span>
          </div>
        </div>
        <small>
          Conçu pour les écoles de la République démocratique du Congo
        </small>
      </section>
      <section className="login-form">
        <div className="login-card">
          <span className="brand-icon">
            <GraduationCap size={30} />
          </span>
          <div className="eyebrow">BIENVENUE SUR SUIVISCOLAIRE</div>
          <h2>Heureux de vous retrouver.</h2>
          <p>Connectez-vous à votre espace scolaire.</p>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={submit}>
            <label>
              Adresse e-mail
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="Votre adresse e-mail"
              />
            </label>
            <label>
              Mot de passe
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Votre mot de passe"
              />
            </label>
            <button className="button" disabled={waiting}>
              {waiting ? "Connexion…" : "Se connecter"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="login-help">
            Besoin d’un accès ? Contactez l’administrateur de votre
            établissement.
          </p>
          <div className="demo-label">
            <span /> Plateforme de démonstration · données fictives
          </div>
        </div>
      </section>
    </div>
  );
}
function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
}) {
  return (
    <div className="stat">
      <span className="stat-icon">{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Field({
  label,
  name,
  value = "",
  type = "text",
  ...props
}: {
  label: string;
  name: string;
  value?: any;
  type?: string;
  min?: any;
  max?: any;
  step?: any;
}) {
  return (
    <label>
      {label}
      <input name={name} defaultValue={value} type={type} required {...props} />
    </label>
  );
}
function Form({
  title,
  onSubmit,
  children,
}: {
  title: string;
  onSubmit: (f: Record<string, string>) => Promise<boolean>;
  children: ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="edit-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<
          string,
          string
        >;
        setSaving(true);
        try {
          await onSubmit(f);
        } finally {
          setSaving(false);
        }
      }}
    >
      <h3>{title}</h3>
      {children}
      <button className="button" disabled={saving}>
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
function SubjectEditor({
  subject: s,
  save,
}: {
  subject: Row;
  save: (t: string, v: Row, id?: string) => Promise<boolean>;
}) {
  return (
    <form
      className="subject-editor"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void save(
          "web_subjects",
          {
            period_max: Number(f.get("period")),
            exam_max: Number(f.get("exam")),
          },
          s.id,
        );
      }}
    >
      <strong>{s.name}</strong>
      <Field
        label="Max. période"
        name="period"
        type="number"
        value={s.period_max}
        min={1}
      />
      <Field
        label="Max. examen"
        name="exam"
        type="number"
        value={s.exam_max}
        min={1}
      />
      <button className="button secondary">Enregistrer</button>
    </form>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
