"use client";

import type { PortfolioStatusPayload } from "@/lib/project-status/types";

interface Props {
  data: PortfolioStatusPayload;
  onProjectClick: (projectName: string) => void;
  onRiskClick: (projectName: string) => void;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function statusLabel(value?: string | null) {
  return value?.trim() || "—";
}

function isRisk(value?: string) {
  const normalized = (value ?? "").toLowerCase();
  return normalized.includes("risk") || normalized.includes("riesgo");
}

function taskTone(value?: string | null) {
  const status = (value ?? "").toLowerCase();
  if (status === "done") return "text-emerald-700 dark:text-emerald-400";
  if (status === "blocked") return "text-red-700 dark:text-red-400";
  if (status === "in progress" || status === "waiting") return "text-amber-700 dark:text-amber-400";
  return "text-slate-600 dark:text-slate-300";
}

export default function PortfolioStatusTable({ data, onProjectClick, onRiskClick }: Props) {
  return (
    <div className="max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Proyecto</th>
              <th className="px-3 py-3 font-semibold">Inicio</th>
              <th className="px-3 py-3 font-semibold">Estado General</th>
              <th className="px-3 py-3 font-semibold">Test DSS</th>
              <th className="px-3 py-3 font-semibold">EPG</th>
              <th className="px-3 py-3 font-semibold">Territory</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.projects.map((project) => (
              <tr key={project.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3">
                  <button onClick={() => onProjectClick(project.name)} className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
                    {project.name}
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">{formatDate(project.startDate)}</td>
                <td className="whitespace-nowrap px-3 py-3">
                  {isRisk(project.status) ? (
                    <button onClick={() => onRiskClick(project.name)} className="font-semibold text-red-700 hover:underline dark:text-red-400">
                      {statusLabel(project.status)}
                    </button>
                  ) : (
                    <span className="font-medium text-slate-700 dark:text-slate-200">{statusLabel(project.status)}</span>
                  )}
                </td>
                <td className={`whitespace-nowrap px-3 py-3 font-medium ${taskTone(project.testDssStatus)}`}>{statusLabel(project.testDssStatus)}</td>
                <td className={`whitespace-nowrap px-3 py-3 font-medium ${taskTone(project.epgStatus)}`}>{statusLabel(project.epgStatus)}</td>
                <td className={`whitespace-nowrap px-3 py-3 font-medium ${taskTone(project.territoryStatus)}`}>{statusLabel(project.territoryStatus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
