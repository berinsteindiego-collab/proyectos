"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ConvivaLiveSnapshot } from "@/lib/conviva/client";

const SUGGESTIONS = ["Modern Family", "El Encargado", "Bluey"];

type Status = "idle" | "loading" | "empty" | "error";

function barPct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(2, Math.round((value / max) * 100));
}

function BreakdownList({
  title,
  items,
}: {
  title: string;
  items: ConvivaLiveSnapshot["titles"];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.name}
            className="grid grid-cols-[84px_1fr_56px] items-center gap-2 text-sm"
          >
            <span
              className="truncate text-slate-700 dark:text-slate-300"
              title={item.name}
            >
              {item.name}
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <span
                className="block h-full rounded-full bg-indigo-600 dark:bg-indigo-400"
                style={{ width: `${barPct(item.value, max)}%` }}
              />
            </span>
            <span className="text-right font-mono text-xs text-slate-500 dark:text-slate-400">
              {item.value.toLocaleString("es-AR")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ConvivaPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("title") ?? SUGGESTIONS[0]);
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<ConvivaLiveSnapshot | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const requestRef = useRef(0);

  async function runSearch(rawTitle: string) {
    const title = rawTitle.trim();
    if (!title) return;
    const requestId = ++requestRef.current;
    setStatus("loading");

    try {
      const res = await fetch(`/api/live?title=${encodeURIComponent(title)}`);
      const body = await res.json();
      if (requestId !== requestRef.current) return;

      if (res.ok && body.ok && body.live) {
        if (!body.live.matchedAssets || body.live.matchedAssets.length === 0) {
          setData(null);
          setStatus("empty");
        } else {
          setData(body.live as ConvivaLiveSnapshot);
          setStatus("idle");
        }
      } else {
        setErrorMsg(body.error ?? `HTTP ${res.status}`);
        setData(null);
        setStatus("error");
      }
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setErrorMsg(err instanceof Error ? err.message : "No se pudo conectar.");
      setData(null);
      setStatus("error");
    }
  }

  useEffect(() => {
    runSearch(query);
    // Solo al montar: busca lo que venga en ?title= o la primera sugerencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Pulse Conviva
        </h1>
        <p className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">
          Buscá un título y mirá cuánta gente lo está viendo ahora mismo, en
          vivo — sin preguntas, solo escribís y busca.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query);
        }}
        className="flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre del contenido, ej. Modern Family"
          autoComplete="off"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Buscar
        </button>
      </form>

      <div className="-mt-2 flex gap-2">
        {SUGGESTIONS.map((title) => (
          <button
            key={title}
            type="button"
            onClick={() => {
              setQuery(title);
              runSearch(title);
            }}
            className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-600 transition hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-indigo-400"
          >
            {title}
          </button>
        ))}
      </div>

      {status === "loading" && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Buscando &ldquo;{query}&rdquo; en Conviva…
        </div>
      )}

      {status === "empty" && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          No encontramos audiencia para <strong>&ldquo;{query}&rdquo;</strong>{" "}
          ahora mismo.
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          No se pudo consultar Conviva.
          <br />
          <span className="font-mono text-xs">{errorMsg}</span>
        </div>
      )}

      {data && status === "idle" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              {data.titleQuery}
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> en
                vivo
              </span>
            </div>
            <span className="font-mono text-xs text-slate-400">
              actualizado{" "}
              {new Date(data.updatedAt).toLocaleTimeString("es-AR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{" "}
                Concurrentes
              </div>
              <div className="mt-1 font-mono text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                {data.concurrentPlays.toLocaleString("es-AR")}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <div className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                En vivo
              </div>
              <div className="mt-1 font-mono text-xl font-semibold text-slate-900 dark:text-slate-100">
                {data.liveConcurrentPlays.toLocaleString("es-AR")}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <div className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                On demand
              </div>
              <div className="mt-1 font-mono text-xl font-semibold text-slate-900 dark:text-slate-100">
                {data.vodConcurrentPlays.toLocaleString("es-AR")}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Assets que matchearon
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {data.matchedAssets.map((a) => (
                <span
                  key={a}
                  className="rounded-md bg-indigo-50 px-2 py-1 font-mono text-xs text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <BreakdownList title="Por título" items={data.titles} />
            <BreakdownList title="Por país" items={data.countries} />
            <div className="sm:col-span-2">
              <BreakdownList title="Por dispositivo" items={data.devices} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
