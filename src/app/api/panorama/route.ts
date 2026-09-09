import { NextResponse } from "next/server";
import { getPanorama } from "@/lib/airtable/panorama";

export async function GET() {
  try {
    return NextResponse.json(await getPanorama());
  } catch (err) {
    console.error("Error obteniendo Panorama:", err);
    return NextResponse.json({ error: "No se pudo cargar Panorama." }, { status: 500 });
  }
}
