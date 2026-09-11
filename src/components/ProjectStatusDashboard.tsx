import type { ProjectStatus, ProjectTask } from "@/lib/project-status/types";

const TERMINAL_STATUSES = new Set(["Done", "Cancelled", "Wont do"]);

function isActionable(task: ProjectTask): boolean {
  return !TERMINAL_STATUSES.has(task.status);
}

export default function ProjectStatusDashboard({ status }: { status: ProjectStatus }) {
  const readiness = status.project.readiness;
  const today = new Date().toISOString().slice(0, 10);
  const isReady = readiness === 100 || status.project.status?.includes("Ready");

  const actionable = status.tasks.filter(isActionable);

  const deadlines = actionable
    .filter((t) => !!t.deadline && t.deadline! >= today)
    .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1))
    .slice(0, 4);

  const alerts = actionable
    .filter(
      (t) =>
        t.openBlocker === true ||
        t.overdueBlocker === true ||
        t.status === "Blocked" ||
        (!!t.deadline && t.deadline < today)
    )
    .sort((a, b) => {
      if (a.overdueBlocker && !b.overdueBlocker) return -1;
      if (!a.overdueBlocker && b.overdueBlocker) return 1;
      if (a.deadline && b.deadline) return a.deadline < b.deadline ? -1 : 1;
      return 0;
    })
    .slice(0, 4);

  if (isReady && actionable.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-lg text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            ✓
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Proyecto listo</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              No quedan tareas pendientes, deadlines próximos ni bloqueos abiertos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Estado operativo
        </h3>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            {actionable.length}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {actionable.length === 1 ? "tarea requiere acción" : "tareas requieren acción"}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">
          Solo se consideran tareas no terminales. Done, Wont do y Cancelled no generan pendientes ni bloqueos.
        </p>
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
