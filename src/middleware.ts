import { NextRequest, NextResponse } from "next/server";

// Simple shared-password gate for the whole app. Not meant to protect
// sensitive data on its own (see README Seguridad) — just to keep the URL
// from being wide open to anyone who finds it, since the PMO base itself
// stays read-only and the Airtable PAT never leaves the server.
const COOKIE_NAME = "pc_auth";
// /api/live queda público: lo llama el Artifact de Claude desde otro origen
// (claude.ai), que nunca va a tener la cookie pc_auth. Solo devuelve
// conteos agregados de audiencia (no PII), así que dejarlo sin gate es
// una decisión aceptada, no un descuido.
const PUBLIC_PATHS = new Set(["/login", "/api/login", "/api/live"]);

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
