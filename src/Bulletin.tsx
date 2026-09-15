import { Fragment } from "react";
import { GraduationCap } from "lucide-react";
import { reportModel, reportNumber } from "./report-model";
type Row = Record<string, any>;
export function Bulletin({
  school,
  student,
  data,
}: {
  school: Row;
  student: Row;
  data: any;
}) {
  const model = reportModel(school, student, data),
    { terms, periods, columns } = model;
  const subjects = data.subjects as Row[];
  const domains = Array.from(new Set(subjects.map((s) => s.domain)));
  const date = student.birth_date
    ? new Intl.DateTimeFormat("fr-FR").format(
        new Date(student.birth_date + "T12:00:00"),
      )
    : "........................";
  const values = (ss: Row[]) =>
    columns.map((c) => (
      <td key={c.key} className={c.max ? "max-cell" : "mark-cell"}>
        {reportNumber(c.value(ss))}
      </td>
    ));
  const summary = (
    label: string,
    values: (number | string | null)[],
    className = "",
  ) => (
    <tr className={"summary-row " + className}>
      <th scope="row">{label}</th>
      {columns.map((c, i) => (
        <td key={c.key} className={c.max ? "max-cell" : "mark-cell"}>
          {typeof values[i] === "number"
            ? reportNumber(values[i] as number)
            : values[i]}
        </td>
      ))}
    </tr>
  );
  const blanks = columns.map(() => null);
  return (
    <article className="bulletin rdc-bulletin">
      <div className="bulletin-heading">
        <span className="congo-flag" aria-label="Drapeau de la RDC">
          ★
        </span>
        <div>
          <h2>RÉPUBLIQUE DÉMOCRATIQUE DU CONGO</h2>
          <strong>
            MINISTÈRE DE L’ÉDUCATION NATIONALE
            <br />
            ET NOUVELLE CITOYENNETÉ
          </strong>
          <p>BULLETIN SCOLAIRE</p>
        </div>
        <GraduationCap size={48} />
      </div>
      <div className="bulletin-identity">
        <div>
          <p>
            ÉCOLE : <strong>{school.name}</strong>
          </p>
          <p>VILLE : {school.city}</p>
          <p>ANNÉE SCOLAIRE : {school.academic_year}</p>
        </div>
        <div>
          <p>
            ÉLÈVE : <strong>{student.name}</strong>
          </p>
          <p>
            CLASSE : {student.class_name} · SEXE : {student.sex}
          </p>
          <p>
            NÉ(E) LE : {date} · MATRICULE :{" "}
            {student.matricule || "................"}
          </p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="report-table">
          <colgroup>
            <col style={{ width: "23%" }} />
            {columns.map((c) => (
              <col key={c.key} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>BRANCHES</th>
              {terms.map((t) => (
                <th key={t} colSpan={periods.length + 5}>
                  TRIMESTRE {t}
                </th>
              ))}
              <th colSpan={2}>TOTAL ANNUEL</th>
            </tr>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.max ? "max-cell" : ""}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {domains.map((domain) => {
              const ss = subjects.filter((s) => s.domain === domain);
              const groups = Array.from(
                new Set(
                  ss.map((s) =>
                    s.name.includes("·") ? s.name.split("·")[0].trim() : "",
                  ),
                ),
              );
              return (
                <Fragment key={domain}>
                  <tr className="domain">
                    <th colSpan={columns.length + 1}>DOMAINE : {domain}</th>
                  </tr>
                  {groups.map((group) => {
                    const grouped = ss.filter(
                      (s) =>
                        (s.name.includes("·")
                          ? s.name.split("·")[0].trim()
                          : "") === group,
                    );
                    return (
                      <Fragment key={group}>
                        {group && (
                          <tr className="branch-group">
                            <th colSpan={columns.length + 1}>{group}</th>
                          </tr>
                        )}
                        {grouped.map((s) => (
                          <tr className="subject-row" key={s.id}>
                            <td>
                              {group
                                ? s.name.split("·").slice(1).join("·").trim()
                                : s.name}
                            </td>
                            {values([s])}
                          </tr>
                        ))}
                        {group && grouped.length > 1 && (
                          <tr className="subtotal">
                            <th scope="row">Sous-total · {group}</th>
                            {values(grouped)}
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  <tr className="subtotal domain-subtotal">
                    <th scope="row">Sous-total du domaine</th>
                    {values(ss)}
                  </tr>
                </Fragment>
              );
            })}
            {summary("MAXIMA GÉNÉRAUX", model.maxima, "maxima")}
            {summary("TOTAUX", model.totals, "totals")}
            {summary(
              "POURCENTAGE",
              model.percentages.map((v) =>
                v === null ? null : reportNumber(v) + " %",
              ),
            )}
            {summary("PLACE DE L’ÉLÈVE", blanks)}
            {summary("NOMBRE D’ÉLÈVES", blanks)}
            {summary("APPLICATION", blanks)}
            {summary("CONDUITE DE L’ÉLÈVE", blanks)}
            {summary("SIGNATURE DE L’ENSEIGNANT", blanks)}
            {summary("SIGNATURE DU RESPONSABLE", blanks)}
          </tbody>
        </table>
      </div>
      <div className="report-decision">
        <div>
          <p>□ L’élève passe dans la classe supérieure.</p>
          <p>□ L’élève double la classe.</p>
        </div>
        <p>
          Fait à ........................................ le ........ / ........
          / ................
        </p>
      </div>
      <div className="signatures">
        <span>Signature de l’élève</span>
        <span>Sceau de l’école</span>
        <span>
          Chef d’établissement
          <br />
          Nom et signature
        </span>
      </div>
    </article>
  );
}
