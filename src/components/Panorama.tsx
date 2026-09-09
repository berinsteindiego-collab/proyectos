"use client";

import { useEffect, useState } from "react";

interface PanoramaData {
  activeProjects: number;
  upcomingProjects: Array<{ id: string; name: string; startDate?: string | null; daysToLaunch?: number | null }>;
  projectsAtRisk: number;
  openBlockers: number;
  upcomingDeadlines: number;
}

function Card({
  eyebrow,
  value,
  detail,
  tone = "default",
}: {
  eyebrow: string;
  value: string | number;
  detail: string;
  tone?: "default" | "warning" | "danger";
}) {
  const accent =
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-slate-950 dark:text-white";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{eyebrow}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${accent}`}>{value}</p>
      <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

export default function Panorama() {
  const [data, setData] = useState<PanoramaData | null>(null);

  useEffect(() => {
    fetch("/api/panorama")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => body && setData(body as PanoramaData))
      .catch(() => undefined);
  }, []);

  if (!data) return null;
  const next = data.upcomingProjects[0];

  return (
    <section className="mb-7">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Panorama</h2>
        <p className="mt-0.5 text-xs text-slate-500">Lo que necesita atención ahora.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          eyebrow="Próximo evento"
          value={next?.daysToLaunch != null ? `${next.daysToLaunch}d` : "—"}
          detail={next?.name ?? "Sin próximos lanzamientos"}
        />
        <Card
          eyebrow="Proyectos en riesgo"
          value={data.projectsAtRisk}
          detail={data.projectsAtRisk === 1 ? "proyecto requiere atención" : "proyectos requieren atención"}
          tone={data.projectsAtRisk > 0 ? "danger" : "default"}
        />
        <Card
          eyebrow="Bloqueos abiertos"
          value={data.openBlockers}
          detail={data.openBlockers === 1 ? "tarea bloqueante pendiente" : "tareas bloqueantes pendientes"}
          tone={data.openBlockers > 0 ? "danger" : "default"}
        />
        <Card
          eyebrow="Próximos deadlines"
          value={data.upcomingDeadlines}
          detail="tareas pendientes · próximos 7 días"
          tone={data.upcomingDeadlines > 0 ? "warning" : "default"}
        />
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        {data.activeProjects} proyectos activos en seguimiento
      </p>
    </section>
  );
}
