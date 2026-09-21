"use client";

import { useState } from "react";

type Market = "ARG" | "MX" | "BR";
type SessionStatus = "connected" | "login_required" | "service_error" | "unverified" | "busy";
type SessionResult = { ok: boolean; market: Market; status: SessionStatus; checkedAt?: string; reason?: string };
type BrowserTest = { ok: boolean; message?: string; chromiumVersion?: string; error?: string };
const MARKETS: { code: Market; name: string; email: string }[] = [
  { code: "ARG", name: "Argentina", email: "testqc-arg@disneytesting.com" },
  { code: "MX", name: "México", email: "testqc-mx@disneytesting.com" },
  { code: "BR", name: "Brasil", email: "testqc-br@disneytesting.com" },
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
  const [testingBrowser, setTestingBrowser] = useState(false);
  const [renewing, setRenewing] = useState<Market | null>(null);
  const [renewMessages, setRenewMessages] = useState<Partial<Record<Market, string>>>({});

  async function renew(market: Market) {
    if (loading || testingBrowser || renewing) return;
    setRenewing(market);
    setRenewMessages(old => ({ ...old, [market]: "Intentando iniciar sesión en Disney+ desde Render..." }));
    try {
      const response = await fetch("/api/qc/renew", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ market }) });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        setRenewMessages(old => ({ ...old, [market]: `Project Control devolvió HTTP ${response.status} sin JSON. Posible timeout de Netlify; comprobá la sesión antes de reintentar.` }));
        return;
      }
      const data = await response.json() as { ok: boolean; message?: string; stage?: string };
      setRenewMessages(old => ({ ...old, [market]: `${data.stage ? `[${data.stage}] ` : ""}${data.message || (data.ok ? "Sesión guardada. Comprobá la sesión." : `Renovación fallida (HTTP ${response.status}).`)}` }));
      if (data.ok) setResults(old => { const next = { ...old }; delete next[market]; return next; });
    } catch {
      setRenewMessages(old => ({ ...old, [market]: "No se pudo completar la solicitud. Comprobá la sesión antes de reintentar." }));
    } finally { setRenewing(null); }
  }
  const [browserResult, setBrowserResult] = useState<string | null>(null);

  function renderBase() {
    const base = process.env.NEXT_PUBLIC_QC_RENDER_URL;
    if (!base) throw new Error("Falta NEXT_PUBLIC_QC_RENDER_URL.");
    return base.replace(/\/$/, "");
  }

  async function testBrowser() {
    if (testingBrowser || loading || renewing) return;
    setTestingBrowser(true);
    setBrowserResult(null);
    try {
      const response = await fetch(`${renderBase()}/browser-test`, { cache: "no-store" });
      const data = (await response.json()) as BrowserTest;
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo iniciar Chromium.");
      setBrowserResult(`OK: Chromium ${data.chromiumVersion ?? ""} inició en Render y se cerró correctamente.`);
    } catch (error) {
      setBrowserResult(`Falló la prueba: ${error instanceof Error ? error.message : "No se pudo contactar Render."}`);
    } finally {
      setTestingBrowser(false);
    }
  }

  async function check(market: Market) {
    if (loading || testingBrowser || renewing) return;
    setLoading(market);
    setErrors((old) => ({ ...old, [market]: "" }));
    try {
      const response = await fetch(
        `${renderBase()}/session-status?market=${market}`,
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
          Cuentas de prueba preconfiguradas. Comprobá la sesión de cada mercado o probá
          que Chromium puede iniciarse en Render.
        </p>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">Prueba técnica · navegador de Render</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Abre y cierra Chromium en el servidor. No inicia sesión ni modifica ninguna cuenta.
        </p>
        <button
          type="button"
          onClick={testBrowser}
          disabled={testingBrowser || loading !== null || renewing !== null}
          className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {testingBrowser ? "Probando Chromium..." : "Probar navegador de Render"}
        </button>
        {browserResult && <p role="status" className="mt-3 text-sm text-slate-700 dark:text-slate-200">{browserResult}</p>}
      </section>
      <div className="grid gap-4">
        {MARKETS.map(({ code, name, email }) => {
          const result = results[code];
          return (
            <section key={code} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-slate-100">{name} · {code}</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{email}</p>
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
                  disabled={loading !== null || testingBrowser || renewing !== null}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {loading === code ? "Comprobando..." : "Comprobar sesión"}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => renew(code)} disabled={loading !== null || testingBrowser || renewing !== null}
                  className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-700 disabled:opacity-50 dark:text-indigo-300">
                  {renewing === code ? "Renovando..." : "Renovar sesión"}
                </button>
                {renewMessages[code] && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{renewMessages[code]}</p>}
              </div>
              {errors[code] && <p role="alert" className="mt-3 text-sm text-red-600">{errors[code]}</p>}
            </section>
          );
        })}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        La prueba del navegador no renueva sesiones. La renovación remota y la consulta
        de contraseñas todavía no están implementadas.
      </p>
    </main>
  );
}
