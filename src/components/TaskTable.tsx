import type { ProjectTask } from "@/lib/project-status/types";

const TERMINAL = new Set(["Done", "Cancelled", "Wont do"]);

function sortTasks(tasks: ProjectTask[]) {
  return [...tasks].sort((a, b) => {
    const aPending = !TERMINAL.has(a.status);
    const bPending = !TERMINAL.has(b.status);
    if (aPending !== bPending) return aPending ? -1 : 1;
    const aDate = a.deadline ?? "9999-99-99";
    const bDate = b.deadline ?? "9999-99-99";
    return aDate < bDate ? -1 : 1;
  });
}

function formatOwner(task: ProjectTask): string {
  const parts = [task.responsible, task.owners && task.owners.length > 0 ? task.owners.join(", ") : null].filter(
    Boolean
  );
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export default function TaskTable({ tasks }: { tasks: ProjectTask[] }) {
  const sorted = sortTasks(tasks);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Tarea</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Deadline</th>
            <th className="px-4 py-3">Responsable</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {sorted.map((task) => (
            <tr key={task.id} className={task.overdueBlocker ? "bg-red-50 dark:bg-red-950/30" : undefined}>
              <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                {task.name}
                {task.isBlocker && (
                  <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950/60 dark:text-red-400">
                    bloqueante
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{task.status}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{task.deadline ?? "—"}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatOwner(task)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                Sin tareas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
