"use client";

import { useState } from "react";

type Market = "ARG" | "MX" | "BR";
type SessionStatus = "connected" | "login_required" | "service_error" | "unverified" | "busy";
type SessionResult = { ok: boolean; market: Market; status: SessionStatus; checkedAt?: string; reason?: string };
const MARKETS: { code: Market; name: string }[] = [
  { code: "ARG", name: "Argentina" },
  { code: "MX", name: "México" },
  { code: "BR", name: "Brasil" },
];
const LABELS: Record<SessionStatus, string> = {
  connected: "Conectada",
  login_required: "Login requerido",
  service_error: "Error de servicio",
  unverified: "Sin verificar",
  busy: "QC en curso",
};

export default function QcSessionsPage() {
  const [results, setResults] = useState<Partial<Record<Market, SessionResult>>>({});
  const [loading, setLoading] = useState<Market | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Market, string>>>({});

  async function check(market: Market) {
    if (loading) return;
    setLoading(market);
    setErrors((old) => ({ ...old, [market]: "" }));
    try {
      const base = process.env.NEXT_PUBLIC_QC_RENDER_URL;
      if (!base) throw new Error("Falta NEXT_PUBLIC_QC_RENDER_URL.");
      const response = await fetch(
        `${base.replace(/\/$/, "")}/session-status?market=${market}`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as SessionResult;
      if (response.status === 429) {
        setResults((old) => ({ ...old, [market]: { ok: false, market, status: "busy" } }));
        return;
      }
      if (!response.ok || !data.ok) throw new Error("No se pudo comprobar la sesión.");
      setResults((old) => ({ ...old, [market]: data }));
    } catch {
      setErrors((old) => ({
        ...old,
        [market]: "No se pudo contactar el servicio de QC. Probá nuevamente.",
      }));
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Disney+ QC · Session Manager
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Comprobá las sesiones de test utilizadas por Render. Los estados se verifican
          bajo demanda; no representan una comprobación continua.
        </p>
      </div>
      <div className="grid gap-4">
        {MARKETS.map(({ code, name }) => {
          const result = results[code];
          return (
            <section key={code} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-slate-100">{name} · {code}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Estado: {result ? LABELS[result.status] : "Aún no comprobada"}
                  </p>
                  {result?.checkedAt && (
                    <p className="mt-1 text-xs text-slate-400">
                      Última comprobación: {new Date(result.checkedAt).toLocaleString("es-AR")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => check(code)}
                  disabled={loading !== null}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {loading === code ? "Comprobando..." : "Comprobar sesión"}
                </button>
              </div>
              {errors[code] && <p role="alert" className="mt-3 text-sm text-red-600">{errors[code]}</p>}
            </section>
          );
        })}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Renovación remota y consulta de contraseñas pendientes de integración segura.
        Este módulo no modifica las sesiones existentes.
      </p>
    </main>
  );
}
