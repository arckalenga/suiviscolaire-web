type Row = Record<string, any>;
export function reportModel(
  school: Row,
  student: Row,
  data: { subjects: Row[]; assignments: Row[]; marks: Row[] },
) {
  const terms = Array.from({ length: Number(school.terms) }, (_, i) => i + 1);
  const periods = Array.from(
    { length: Number(school.periods_per_term) },
    (_, i) => i + 1,
  );
  const assignments = data.assignments.filter(
    (a) => a.published && a.class_name === student.class_name,
  );
  const marks = new Map(
    data.marks
      .filter((m) => m.student_id === student.id)
      .map((m) => [m.assignment_id, Number(m.score)]),
  );
  const mark = (s: Row, t: number, p: number): number | null => {
    const aa = assignments.filter(
      (a) => a.subject_id === s.id && a.term === t && a.period === p,
    );
    const maximum = aa.reduce((sum, a) => sum + Number(a.max_score), 0);
    if (!aa.length || maximum <= 0 || aa.some((a) => !marks.has(a.id)))
      return null;
    return (
      (aa.reduce((sum, a) => sum + marks.get(a.id)!, 0) / maximum) *
      Number(p === 0 ? s.exam_max : s.period_max)
    );
  };
  const sum = (values: (number | null)[]) =>
    values.length && values.every((v) => v !== null)
      ? values.reduce<number>((n, v) => n + v!, 0)
      : null;
  const columns = terms.flatMap((t) => [
    {
      key: t + "-pm",
      label: "MAX PÉR.",
      max: true,
      value: (ss: Row[]) => ss.reduce((n, s) => n + Number(s.period_max), 0),
    },
    ...periods.map((p) => ({
      key: t + "-p" + p,
      label: "P" + ((t - 1) * periods.length + p),
      max: false,
      value: (ss: Row[]) => sum(ss.map((s) => mark(s, t, p))),
    })),
    {
      key: t + "-em",
      label: "MAX EX.",
      max: true,
      value: (ss: Row[]) => ss.reduce((n, s) => n + Number(s.exam_max), 0),
    },
    {
      key: t + "-ex",
      label: "EXAMEN",
      max: false,
      value: (ss: Row[]) => sum(ss.map((s) => mark(s, t, 0))),
    },
    {
      key: t + "-tm",
      label: "MAX TRIM.",
      max: true,
      value: (ss: Row[]) =>
        ss.reduce(
          (n, s) =>
            n + periods.length * Number(s.period_max) + Number(s.exam_max),
          0,
        ),
    },
    {
      key: t + "-total",
      label: "PTS OBT.",
      max: false,
      value: (ss: Row[]) =>
        sum(ss.flatMap((s) => [...periods, 0].map((p) => mark(s, t, p)))),
    },
  ]);
  columns.push(
    {
      key: "year-max",
      label: "MAX",
      max: true,
      value: (ss: Row[]) =>
        terms.length *
        ss.reduce(
          (n, s) =>
            n + periods.length * Number(s.period_max) + Number(s.exam_max),
          0,
        ),
    },
    {
      key: "year-score",
      label: "PTS OBT.",
      max: false,
      value: (ss: Row[]) =>
        sum(
          ss.flatMap((s) =>
            terms.flatMap((t) => [...periods, 0].map((p) => mark(s, t, p))),
          ),
        ),
    },
  );
  const maxima = columns.map((c) => (c.max ? c.value(data.subjects) : null));
  const reference = (index: number) => {
    const c = columns[index];
    if (c.key === "year-score") return columns[index - 1].value(data.subjects);
    if (c.label.startsWith("P") && c.label !== "PTS OBT.")
      return data.subjects.reduce((n, s) => n + Number(s.period_max), 0);
    if (c.label === "EXAMEN")
      return data.subjects.reduce((n, s) => n + Number(s.exam_max), 0);
    return data.subjects.reduce(
      (n, s) => n + periods.length * Number(s.period_max) + Number(s.exam_max),
      0,
    );
  };
  const totals = columns.map((c) => (c.max ? null : c.value(data.subjects)));
  const percentages = totals.map((v, i) =>
    v === null || !reference(i) ? null : (v! / reference(i)!) * 100,
  );
  return { terms, periods, columns, maxima, totals, percentages };
}
export const reportNumber = (n: number | null) =>
  n === null ? "" : Number(n.toFixed(1)).toString();
