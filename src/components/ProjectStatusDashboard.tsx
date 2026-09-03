import type { ProjectStatus, ProjectTask } from "@/lib/project-status/types";

// Mini "status of project X" dashboard, per the mockup Diego approved:
// a donut chart of task-status breakdown + upcoming deadlines + overdue/
// blocked list. Built entirely from fields Airtable already provides
// (task status, deadline, isBlocker) — no time-tracking data involved.
const BUCKET_ORDER = ["Hechas", "En curso", "Bloqueadas", "Sin iniciar", "Otras"] as const;
type Bucket = (typeof BUCKET_ORDER)[number];

const BUCKET_COLORS: Record<Bucket, string> = {
  Hechas: "#16a34a",
  "En curso": "#2563eb",
  Bloqueadas: "#e11d48",
  "Sin iniciar": "#94a3b8",
  Otras: "#cbd5e1",
};

const TERMINAL_DONE = new Set(["Done"]);
const IGNORED = new Set(["Cancelled", "Wont do"]);

function bucketFor(task: ProjectTask): Bucket {
  if (task.status === "Blocked" || task.isBlocker) return "Bloqueadas";
  if (TERMINAL_DONE.has(task.status)) return "Hechas";
  if (task.status === "In Progress" || task.status === "Waiting") return "En curso";
  if (task.status === "Not Started") return "Sin iniciar";
  return "Otras";
}

function buildBreakdown(tasks: ProjectTask[]): { counts: Partial<Record<Bucket, number>>; total: number } {
  const counts: Partial<Record<Bucket, number>> = {};
  let total = 0;
  for (const t of tasks) {
    if (IGNORED.has(t.status)) continue;
    const b = bucketFor(t);
    counts[b] = (counts[b] ?? 0) + 1;
    total += 1;
  }
  return { counts, total };
}

function conicGradient(counts: Partial<Record<Bucket, number>>, total: number): string {
  if (total === 0) return "conic-gradient(#e2e8f0 0deg 360deg)";
  let acc = 0;
  const stops: string[] = [];
  for (const key of BUCKET_ORDER) {
    const n = counts[key] ?? 0;
    if (n === 0) continue;
    const start = (acc / total) * 360;
    acc += n;
    const end = (acc / total) * 360;
    stops.push(`${BUCKET_COLORS[key]} ${start}deg ${end}deg`);
  }
  return `conic-gradient(${stops.join(", ")})`;
}

export default function ProjectStatusDashboard({ status }: { status: ProjectStatus }) {
  const { counts, total } = buildBreakdown(status.tasks);
  const gradient = conicGradient(counts, total);
  const readiness = status.project.readiness;
  const today = new Date().toISOString().slice(0, 10);

  const deadlines = status.tasks
    .filter((t) => !!t.deadline && !IGNORED.has(t.status) && t.status !== "Done")
    .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1))
    .slice(0, 4);

  const alerts = status.tasks
    .filter(
      (t) =>
        !IGNORED.has(t.status) &&
        t.status !== "Done" &&
        (t.isBlocker || t.status === "Blocked" || (!!t.deadline && t.deadline < today))
    )
    .slice(0, 4);

  return (
    <div className="grid gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2">
      <div className="flex flex-col items-center justify-center">
        <div className="relative flex h-36 w-36 items-center justify-center rounded-full" style={{ backgroundImage: gradient }}>
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white dark:bg-slate-900">
            <div className="text-center">
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {readiness != null ? `${readiness}%` : "—"}
              </div>
              <div className="text-[10px] uppercase text-slate-400 dark:text-slate-500">readiness</div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          {BUCKET_ORDER.map((key) =>
            counts[key] ? (
              <span key={key} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BUCKET_COLORS[key] }} />
                {key} ({counts[key]})
              </span>
            ) : null
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Próximos deadlines
          </h3>
          {deadlines.length === 0 ? (
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">Sin deadlines próximos.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {deadlines.map((t) => (
                <li key={t.id} className="truncate">
                  {t.name} — {t.deadline}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-red-500 dark:text-red-400">
            Vencidas / bloqueantes
          </h3>
          {alerts.length === 0 ? (
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">Nada vencido ni bloqueado.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm text-red-700 dark:text-red-400">
              {alerts.map((t) => (
                <li key={t.id} className="truncate">
                  {t.name}
                  {t.deadline ? ` — ${t.deadline}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
