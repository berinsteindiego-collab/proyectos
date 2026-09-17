"use client";

import { useState } from "react";

export default function QCPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runQC() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/qc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "El encargado",
          season: 3,
          episode: 7,
          market: "ARG",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo ejecutar el QC.");
      }

      setResult(data.output);
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
          Consultá información de QC de películas, series y episodios.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <textarea
          rows={2}
          defaultValue="Decime los subtítulos y doblajes del episodio 7 de la temporada 3 de El encargado"
          className="w-full resize-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
        />

        <div className="mt-3 flex justify-end">
          <button
            onClick={runQC}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Ejecutando QC..." : "Consultar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Resultado QC
          </h2>

          <pre className="whitespace-pre-wrap text-xs leading-6 text-slate-700 dark:text-slate-300">
            {result}
          </pre>
        </div>
      )}

      <p className="mt-3 text-center text-xs text-slate-400">
        Entorno local de prueba
      </p>
    </div>
  );
}