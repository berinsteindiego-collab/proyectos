import { NextRequest, NextResponse } from "next/server";

// Simple shared-password gate for the whole app. Not meant to protect
// sensitive data on its own (see README Seguridad) — just to keep the URL
// from being wide open to anyone who finds it, since the PMO base itself
// stays read-only and the Airtable PAT never leaves the server.
const COOKIE_NAME = "pc_auth";
// /api/live, /api/mcp y /conviva quedan públicos. Los dos primeros porque
// los llama código que nunca tiene la cookie pc_auth (el fetch() del
// Artifact y, cuando el admin de la organización habilite conectores
// personalizados, el conector MCP). /conviva es la página real de Pulse
// Conviva: la dejamos sin gate a propósito, mismo criterio que /api/live —
// solo muestra conteos agregados de audiencia (no PII) — para que
// cualquiera en Disney entre directo con el link, sin pedir la clave del
// sitio primero.
const PUBLIC_PATHS = new Set(["/login", "/api/login", "/api/live", "/api/mcp", "/conviva"]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const password = process.env.SITE_PASSWORD;
  // No password configured (e.g. local dev without .env.local) — don't lock
  // anyone out.
  if (!password) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie === password) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
