"use client";

import { useState } from "react";

type QcTrack = {
  name: string;
  language: string;
};

type QcResult = {
  title: string;
  contentTitle: string;
  market: string;
  marketLabel: string;
  isSeries: boolean;
  season: number | null;
  episode: number | null;
  titleTreatment: {
    available: boolean;
    match?: boolean;
    metadataTitle?: string;
    logoText?: string;
    imageUrl?: string;
    error?: string;
  };
  tracks: {
    audio: QcTrack[];
    subtitles: QcTrack[];
    cc: QcTrack[];
    forced: QcTrack[];
  };
};

const MARKETS = [
  { value: "ARG", label: "Argentina" },
  { value: "MX", label: "México (buscar en inglés)" },
  { value: "BR", label: "Brasil" },
];

function TrackList({ label, tracks }: { label: string; tracks: QcTrack[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>

      {tracks.length === 0 ? (
        <p className="mt-1 text-sm text-slate-400">— Ninguno</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {tracks.map((track, index) => (
            <li key={index} className="text-sm text-slate-700 dark:text-slate-300">
              {track.name}
              {track.language ? (
                <span className="text-slate-400"> [{track.language}]</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function QCPage() {
  const [title, setTitle] = useState("");
  const [season, setSeason] = useState("");
  const [episode, setEpisode] = useState("");
  const [market, setMarket] = useState("ARG");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QcResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runQC(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const renderUrl = process.env.NEXT_PUBLIC_QC_RENDER_URL;

      if (!renderUrl) {
        throw new Error(
          "Falta configurar NEXT_PUBLIC_QC_RENDER_URL en Netlify."
        );
      }

      // Le pegamos directo a Render desde el navegador (CORS), sin
      // pasar por una función de Netlify: un QC completo tarda
      // 20-60s+ y las funciones síncronas de Netlify cortan a los
      // 10s (26s en Pro), muy por debajo de eso.
      const params = new URLSearchParams({ title, market });

      if (season) params.set("season", season);
      if (episode) params.set("episode", episode);

      const response = await fetch(
        `${renderUrl.replace(/\/$/, "")}/qc?${params.toString()}`
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo ejecutar el QC.");
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo ejecutar el QC."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Disney+ QC
        </h1>

        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Consultá doblajes, subtítulos y title treatment de una película o
          episodio.
        </p>
      </div>

      <form
        onSubmit={runQC}
        className="mx-auto mt-8 max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (ej. Modern Family)"
            className="sm:col-span-4 rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:border-slate-700 dark:text-slate-100"
          />

          <input
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            placeholder="Temporada"
            type="number"
            min={1}
            className="rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:border-slate-700 dark:text-slate-100"
          />

          <input
            value={episode}
            onChange={(e) => setEpisode(e.target.value)}
            placeholder="Episodio"
            type="number"
            min={1}
            className="rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:border-slate-700 dark:text-slate-100"
          />

          <select
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            className="sm:col-span-2 rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:text-slate-100"
          >
            {MARKETS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <p className="mt-2 text-xs text-slate-400">
          Dejá temporada/episodio vacíos para una película.
        </p>

        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Ejecutando QC..." : "Consultar"}
          </button>
        </div>
      </form>

      {loading && (
        <p className="mt-4 text-center text-xs text-slate-400">
          Puede tardar 30-60s (login, búsqueda y playback contra Disney+ real).
        </p>
      )}

      {error && (
        <div className="mx-auto mt-6 max-w-xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {result.title}
              {result.isSeries
                ? ` · T${result.season}:E${result.episode}`
                : " · Película"}
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {result.contentTitle} · {result.marketLabel}
            </p>
          </div>

          <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/50">
            {result.titleTreatment?.available ? (
              <div className="flex items-center gap-3">
                {result.titleTreatment.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={result.titleTreatment.imageUrl}
                    alt="Title treatment"
                    className="h-10 w-auto shrink-0 rounded bg-black/80 object-contain px-2 py-1"
                  />
                ) : null}

                <p
                  className={
                    result.titleTreatment.match
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }
                >
                  {result.titleTreatment.match ? "✓" : "⚠"} Title treatment:{" "}
                  {result.titleTreatment.logoText} vs. {result.titleTreatment.metadataTitle}
                </p>
              </div>
            ) : (
              <p className="text-slate-400">
                Title treatment no disponible ({result.titleTreatment?.error})
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TrackList label="🔊 Audio / Doblajes" tracks={result.tracks.audio} />
            <TrackList label="💬 Subtítulos" tracks={result.tracks.subtitles} />
            <TrackList label="♿ Closed Captions" tracks={result.tracks.cc} />
            <TrackList label="⚡ Forced Narratives" tracks={result.tracks.forced} />
          </div>
        </div>
      )}

      <p className="mt-3 text-center text-xs text-slate-400">
        Entorno de prueba
      </p>
    </div>
  );
}
