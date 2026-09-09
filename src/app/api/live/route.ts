import { NextRequest, NextResponse } from "next/server";
import { getConvivaLiveSnapshot } from "@/lib/conviva/client";

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title")?.trim();
  if (!title) return NextResponse.json({ error: "Falta el parámetro title." }, { status: 400 });

  try {
    const live = await getConvivaLiveSnapshot(title);
    return NextResponse.json({ ok: true, live });
  } catch (err) {
    console.error("Error consultando Conviva:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo consultar Conviva." },
      { status: 502 }
    );
  }
}
