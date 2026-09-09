"use client";

export interface LiveSnapshotData {
  titleQuery: string;
  matchedAssets: string[];
  concurrentPlays: number;
  liveConcurrentPlays: number;
  vodConcurrentPlays: number;
  titles: Array<{ name: string; value: number; percentage?: number }>;
  countries: Array<{ name: string; value: number; percentage?: number }>;
  devices: Array<{ name: string; value: number; percentage?: number }>;
  updatedAt: string;
}

function compact(value: number) {
  return new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatPercentage(value?: number) {
  if (value == null) return "";
  if (value > 0 && value < 0.1) return "<0,1%";
  if (value === 0) return "0%";
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}%`;
}

function Breakdown({ title, items }: { title: string; items: LiveSnapshotData["countries"] }) {
  if (!items.length) return null;

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="mt-3 space-y-2.5">
        {items.slice(0, 5).map((item) => (
          <div key={item.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-sm">
            <span className="min-w-0 break-words leading-snug text-slate-700 dark:text-slate-300" title={item.name}>
              {item.name}
            </span>
            <span className="whitespace-nowrap text-right font-medium text-slate-900 dark:text-slate-100">
              {compact(item.value)}
              {item.percentage != null && (
                <span className="ml-1.5 font-normal text-slate-400">· {formatPercentage(item.percentage)}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LiveSnapshot({ live }: { live: LiveSnapshotData }) {
  return (
    <div className="max-w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Live now</p>
          </div>
          <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{live.titleQuery}</h3>
        </div>
        <span className="text-xs text-slate-400">Conviva</span>
      </div>

      <div className="mt-5">
        <p className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">{compact(live.concurrentPlays)}</p>
        <p className="mt-1 text-sm text-slate-500">usuarios concurrentes</p>
      </div>

      {(live.liveConcurrentPlays > 0 || live.vodConcurrentPlays > 0) && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-red-50 px-3 py-1.5 font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
            Live {compact(live.liveConcurrentPlays)}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            VoD {compact(live.vodConcurrentPlays)}
          </span>
        </div>
      )}

      {(live.titles.length > 0 || live.countries.length > 0 || live.devices.length > 0) && (
        <div className="mt-5 grid gap-6 border-t border-slate-100 pt-5 md:grid-cols-3 dark:border-slate-800">
          <Breakdown title="Títulos" items={live.titles} />
          <Breakdown title="Países" items={live.countries} />
          <Breakdown title="Dispositivos" items={live.devices} />
        </div>
      )}

      {live.matchedAssets.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">No encontré títulos activos que contengan “{live.titleQuery}”.</p>
      )}
    </div>
  );
}
