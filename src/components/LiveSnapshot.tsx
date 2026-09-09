"use client";

export interface LiveSnapshotData {
  titleQuery: string;
  matchedAssets: string[];
  concurrentPlays: number;
  countries: Array<{ name: string; value: number; percentage?: number }>;
  devices: Array<{ name: string; value: number; percentage?: number }>;
  updatedAt: string;
}

function compact(value: number) {
  return new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function Breakdown({ title, items }: { title: string; items: LiveSnapshotData["countries"] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="mt-2 space-y-2">
        {items.slice(0, 4).map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-slate-700 dark:text-slate-300">{item.name}</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {item.percentage != null ? `${item.percentage}%` : compact(item.value)}
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

      {(live.countries.length > 0 || live.devices.length > 0) && (
        <div className="mt-5 grid gap-5 border-t border-slate-100 pt-4 sm:grid-cols-2 dark:border-slate-800">
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
