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
  diagnostics?: {
    activeAssetCount: number;
    sampleAssets: string[];
    pointCount: number;
    selectedPointIndex: number;
  };
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
        {items.slice(0, 5).map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-slate-700 dark:text-slate-300">{item.name}</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {compact(item.value)}{item.percentage != null ? ` · ${item.percentage}%` : ""}
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
          <span className="rounded-full bg-red-50 px-3 py-1.5 font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">Live {compact(live.liveConcurrentPlays)}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">VoD {compact(live.vodConcurrentPlays)}</span>
        </div>
      )}

      {(live.titles.length > 0 || live.countries.length > 0 || live.devices.length > 0) && (
        <div className="mt-5 grid gap-5 border-t border-slate-100 pt-4 md:grid-cols-3 dark:border-slate-800">
          <Breakdown title="Títulos" items={live.titles} />
          <Breakdown title="Países" items={live.countries} />
          <Breakdown title="Dispositivos" items={live.devices} />
        </div>
      )}

      {live.matchedAssets.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">No encontré títulos activos que contengan “{live.titleQuery}”.</p>
      )}

      {live.diagnostics && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold uppercase tracking-wider">Conviva debug · temporal</p>
          <div className="mt-2 space-y-1">
            <p>Assets activos recibidos: <strong>{live.diagnostics.activeAssetCount}</strong></p>
            <p>Time series points: <strong>{live.diagnostics.pointCount}</strong> · punto usado: <strong>{live.diagnostics.selectedPointIndex}</strong></p>
            <p>Matches con “{live.titleQuery}”: <strong>{live.matchedAssets.length}</strong></p>
          </div>
          <div className="mt-3">
            <p className="font-medium">Ejemplos de assets recibidos:</p>
            {live.diagnostics.sampleAssets.length ? (
              <ul className="mt-1 space-y-1 break-words">
                {live.diagnostics.sampleAssets.map((asset, index) => (
                  <li key={`${asset}-${index}`}>• {asset}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1">No llegaron nombres de assets en dimensional_data.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
