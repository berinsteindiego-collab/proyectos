import type { ProjectStatus } from "@/lib/project-status/types";

function StatusPill({ status }: { status?: string }) {
  if (!status) return null;
  const tone =
    /risk|bloque|atras/i.test(status)
      ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400"
      : /track|ok|listo/i.test(status)
      ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-400"
      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>{status}</span>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const tone = pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-blue-500" : "bg-amber-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

export default function ProjectBrief({ status }: { status: ProjectStatus }) {
  const { project, summary } = status;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{project.name}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {[project.category, project.format, project.region].filter(Boolean).join(" · ")}
          </p>
        </div>
        <StatusPill status={project.status} />
      </div>

      {summary.totalTasks > 0 && (
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
            <span>Avance de tareas</span>
            <span>{Math.round((summary.completedTasks / summary.totalTasks) * 100)}%</span>
          </div>
          <ProgressBar value={(summary.completedTasks / summary.totalTasks) * 100} />
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric label="Launch Readiness" value={project.readiness != null ? `${project.readiness}%` : "—"} />
        <Metric label="Días para lanzamiento" value={project.daysToLaunch ?? "—"} />
        <Metric label="Tareas totales" value={summary.totalTasks} />
        <Metric label="Completadas" value={summary.completedTasks} />
        <Metric label="Pendientes" value={summary.pendingTasks} />
        <Metric label="Bloqueos abiertos" value={summary.openBlockers ?? "—"} />
        <Metric label="Bloqueos vencidos" value={summary.overdueBlockers ?? "—"} />
        <Metric label="Fecha inicio" value={project.startDate ?? "—"} />
      </div>

      {project.description && (
        <p className="mt-6 border-t border-slate-100 pt-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
          {project.description}
        </p>
      )}
    </div>
  );
}
