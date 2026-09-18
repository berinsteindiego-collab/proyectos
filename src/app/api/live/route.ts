import { NextRequest, NextResponse } from "next/server";
import { getConvivaLiveSnapshot } from "@/lib/conviva/client";

// Este endpoint lo llama el Artifact de Pulse Conviva (hosteado en
// claude.ai), que corre en un origen distinto al de este sitio. Solo
// devuelve conteos agregados de audiencia (no PII), así que se habilita
// CORS abierto en vez de restringirlo a un origen puntual — el origen
// exacto que usa el runtime de Artifacts no es algo que podamos fijar de
// antemano. CONVIVA_CLIENT_ID/SECRET nunca salen de este handler.
function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title")?.trim();
  if (!title) return withCors(NextResponse.json({ error: "Falta el parámetro title." }, { status: 400 }));

  try {
    const live = await getConvivaLiveSnapshot(title);
    return withCors(NextResponse.json({ ok: true, live }));
  } catch (err) {
    console.error("Error consultando Conviva:", err);
    return withCors(
      NextResponse.json(
        { error: err instanceof Error ? err.message : "No se pudo consultar Conviva." },
        { status: 502 }
      )
    );
  }
}
