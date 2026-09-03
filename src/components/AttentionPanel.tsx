"use client";

import { useEffect, useState } from "react";

interface OverviewTaskAlert {
  task: { id: string; name: string; deadline?: string | null };
  projectName: string;
  projectId: string;
}

interface OverviewAtRiskProject {
  id: string;
  name: string;
  status?: string;
}

interface OverviewAlerts {
  atRisk: OverviewAtRiskProject[];
  overdueTasks: OverviewTaskAlert[];
  upcomingDeadlines: OverviewTaskAlert[];
}

/**
 * "Novedades" — a passive panel on the home screen so important things
 * (projects at risk, overdue tasks, deadlines this week) are visible
 * without having to ask the chat first. Renders nothing if there's nothing
 * to flag, or if the request fails (never blocks the rest of the page).
 */
export default function AttentionPanel() {
  const [data, setData] = useState<OverviewAlerts | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/overview")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((body) => {
        if (!cancelled) setData(body as OverviewAlerts);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed || !data) return null;
  const total = data.atRisk.length + data.overdueTasks.length + data.upcomingDeadlines.length;
  if (total === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-300">Novedades</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {data.atRisk.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-red-700 dark:text-red-400">
              En riesgo ({data.atRisk.length})
            </p>
            <ul className="mt-1.5 space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {data.atRisk.map((p) => (
                <li key={p.id} className="truncate">
                  {p.name}
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.overdueTasks.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-red-700 dark:text-red-400">
              Vencidas ({data.overdueTasks.length})
            </p>
            <ul className="mt-1.5 space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {data.overdueTasks.map((o) => (
                <li key={o.task.id} className="truncate">
                  {o.task.name} <span className="text-slate-400 dark:text-slate-500">· {o.projectName}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.upcomingDeadlines.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Esta semana ({data.upcomingDeadlines.length})
            </p>
            <ul className="mt-1.5 space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {data.upcomingDeadlines.map((o) => (
                <li key={o.task.id} className="truncate">
                  {o.task.name} <span className="text-slate-400 dark:text-slate-500">· {o.projectName}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
