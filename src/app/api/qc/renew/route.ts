import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

async function handle(req: NextRequest, status: boolean) {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword || req.cookies.get("pc_auth")?.value !== sitePassword) {
    return NextResponse.json({ ok: false, message: "Iniciá sesión en Project Control." }, { status: 401 });
  }
  const token = process.env.QC_RENEW_TOKEN;
  const base = process.env.QC_RENDER_URL || process.env.NEXT_PUBLIC_QC_RENDER_URL;
  if (!token || !base) {
    return NextResponse.json({ ok: false, message: "Falta configurar QC_RENEW_TOKEN en Project Control." }, { status: 503 });
  }
  let market;
  if (status) market = req.nextUrl.searchParams.get("market");
  else {
    try { market = (await req.json()).market; } catch { return NextResponse.json({ ok: false, message: "Solicitud inválida." }, { status: 400 }); }
  }
  if (!["ARG", "MX", "BR"].includes(market)) return NextResponse.json({ ok: false, message: "Mercado inválido." }, { status: 400 });
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/${status ? "renew-status" : "renew-session"}?market=${market}`, {
      method: status ? "GET" : "POST", headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ ok: false, message: "El intento puede seguir en Render. Esperá y comprobá la sesión antes de reintentar." }, { status: 504 });
  }
}

export async function POST(req: NextRequest) { return handle(req, false); }
export async function GET(req: NextRequest) { return handle(req, true); }
