"use client";

import { useEffect, useState } from "react";

interface PanoramaData {
  year: number;
  activeProjects: number;
  upcomingProjects: Array<{ id: string; name: string; startDate?: string | null; daysToLaunch?: number | null }>;
  standalones: { totalEvents: number; distinctShows: number } | null;
  feedsPeak: { peakFeeds: number; peakMonth?: string | null } | null;
}

function Card({ eyebrow, value, detail }: { eyebrow: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{eyebrow}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
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
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Panorama</h2>
          <p className="mt-0.5 text-xs text-slate-500">Una mirada rápida a la operación.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card eyebrow="En curso" value={data.activeProjects} detail="proyectos activos" />
        <Card
          eyebrow="Próximo evento"
          value={next?.daysToLaunch != null ? `${next.daysToLaunch}d` : "—"}
          detail={next?.name ?? "Sin próximos lanzamientos"}
        />
        <Card
          eyebrow={`Standalones ${data.year}`}
          value={data.standalones?.totalEvents ?? "—"}
          detail={data.standalones ? `${data.standalones.distinctShows} shows distintos` : "Sin datos"}
        />
        <Card
          eyebrow={`Feeds ${data.year}`}
          value={data.feedsPeak?.peakFeeds ?? "—"}
          detail={data.feedsPeak?.peakMonth ? `pico en ${data.feedsPeak.peakMonth}` : "pico simultáneo"}
        />
      </div>
    </section>
  );
}
